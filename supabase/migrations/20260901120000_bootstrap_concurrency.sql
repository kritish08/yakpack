-- Make the signup bootstrap safe against concurrent callers.
--
-- create_trip_from_template() guards itself by looking for an existing organiser
-- membership and returning early. That is idempotent when calls are sequential —
-- a retried registration — but not when they overlap, and in the App Router they
-- always overlap: a layout and its page render concurrently, so both call
-- ensureTripContext() in the same request. Both read "no membership", both pass
-- the guard, and the account ends up organising two identical trips.
--
-- Observed exactly that: one signup, two trips, both member_key 'organiser'.
--
-- A unique index cannot express the rule, because organising several trips is a
-- legitimate thing to do later — it is only the bootstrap that must happen once.
-- So the function takes a transaction-scoped advisory lock keyed on the user.
-- The second caller blocks until the first commits, then sees the membership and
-- returns the same trip, which is what "idempotent" was supposed to mean.
create or replace function public.create_trip_from_template(p_trip_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_template uuid;
  v_trip     uuid;
  v_name     text;
  v_display  text;
  v_cat      record;
  v_new_cat  int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Serialise bootstraps for this user. Transaction-scoped, so it is released on
  -- commit or rollback with nothing to clean up. Keyed on the user id, so two
  -- different signups never wait on each other.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  -- Re-check after the lock: the caller we queued behind may have just done it.
  select m.trip_id into v_trip
    from public.trip_members m
   where m.user_id = v_uid and m.member_key = 'organiser'
   limit 1;
  if v_trip is not null then
    return v_trip;
  end if;

  select p.display_name into v_display from public.profiles p where p.id = v_uid;
  v_name := coalesce(nullif(btrim(p_trip_name), ''), coalesce(v_display, 'My') || '''s trip');

  select t.id into v_template from public.trips t where t.is_template order by t.created_at limit 1;

  insert into public.trips (name, depart_date, is_template, created_by)
  select v_name,
         case when v_template is null then null else (select depart_date from public.trips where id = v_template) end,
         false, v_uid
  returning id into v_trip;

  insert into public.trip_members (trip_id, user_id, member_key, display_name)
  values (v_trip, v_uid, 'organiser', v_display);

  if v_template is not null then
    -- Row by row, keeping a map from template id to new id: sort_order is not
    -- unique within a trip, and joining on it fans out into a cartesian product
    -- that silently duplicates every item.
    create temporary table _cat_map (old_id int, new_id int) on commit drop;

    for v_cat in
      select id, name, icon, sort_order
        from public.categories where trip_id = v_template order by sort_order, id
    loop
      insert into public.categories (trip_id, name, icon, sort_order)
      values (v_trip, v_cat.name, v_cat.icon, v_cat.sort_order)
      returning id into v_new_cat;
      insert into _cat_map (old_id, new_id) values (v_cat.id, v_new_cat);
    end loop;

    insert into public.items
      (trip_id, category_id, name, note, qty, status, assigned_to, scope, carry_tags, sort_order, is_custom)
    select v_trip, m.new_id, i.name, i.note, i.qty, i.status, i.assigned_to, i.scope,
           i.carry_tags, i.sort_order, false
      from public.items i
      join _cat_map m on m.old_id = i.category_id
     where i.trip_id = v_template;

    insert into public.packed (item_id, user_key, packed)
    select i.id, 'organiser', false from public.items i where i.trip_id = v_trip and i.scope = 'each'
    union all
    select i.id, 'shared', false from public.items i where i.trip_id = v_trip and i.scope = 'shared';

    insert into public.itinerary
      (trip_id, day, date, leg, lat, lon, altitude_m, highlights, carry_today,
       prep_tonight, warnings, network, fun, tip)
    select v_trip, t.day, t.date, t.leg, t.lat, t.lon, t.altitude_m, t.highlights,
           t.carry_today, t.prep_tonight, t.warnings, t.network, t.fun, t.tip
      from public.itinerary t
     where t.trip_id = v_template;

    insert into public.trip_contacts (trip_id, role, name, phone, note, sort_order)
    select v_trip, c.role, c.name, c.phone, c.note, c.sort_order
      from public.trip_contacts c
     where c.trip_id = v_template;
  end if;

  return v_trip;
end;
$$;

revoke execute on function public.create_trip_from_template(text) from anon, public;
grant  execute on function public.create_trip_from_template(text) to authenticated;
