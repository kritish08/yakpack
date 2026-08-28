-- Registration bootstrap.
--
-- A new account needs a trip of its own, seeded from the template so the app is
-- not an empty shell on first load. Doing this in SQL keeps it atomic — a signup
-- that fails halfway must not leave a trip with no members, which would be a
-- trip nobody (not even its creator) can see.
--
-- SECURITY DEFINER because it writes rows the caller has no direct policy for
-- (their own membership row), but it derives the user from auth.uid() and never
-- takes a user id as an argument, so it cannot be pointed at anyone else.

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

  -- One trip per account at signup. Re-running is a no-op that returns the
  -- existing trip, so a retried registration cannot mint duplicates.
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
    -- Categories first, keeping a map from template id to the new serial id so
    -- the copied items land in the right category.
    --
    -- Inserted one at a time rather than as a set-returning INSERT joined back
    -- on sort_order: sort_order is not unique within a trip, and joining on it
    -- fans out into a cartesian product that silently duplicates every item in
    -- the affected categories.
    create temporary table _cat_map (old_id int, new_id int) on commit drop;

    for v_cat in
      select id, name, icon, sort_order
        from public.categories
       where trip_id = v_template
       order by sort_order, id
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

    -- Pre-create the packed rows so a first tap is an update, not an insert.
    -- Only the organiser exists at this point. A partner's rows are created the
    -- first time they tap something; "no row" already means "not packed".
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
  end if;

  return v_trip;
end;
$$;

revoke execute on function public.create_trip_from_template(text) from anon, public;
grant  execute on function public.create_trip_from_template(text) to authenticated;
