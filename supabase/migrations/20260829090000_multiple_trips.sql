-- Multiple trips per person.
--
-- The schema already allowed it — `trips` is multi-row and membership is
-- per-trip — but two things pinned each account to exactly one:
--   1. create_trip_from_template() returns early if the caller already organises
--      a trip. That idempotency is correct for the signup bootstrap (a retried
--      registration must not mint duplicates) but wrong as the only way to make
--      a trip, so creation moves to its own function.
--   2. Nothing remembered which trip you were looking at.

-- ── Remember the selection ───────────────────────────────────────────────────
--
-- ON DELETE SET NULL rather than CASCADE: deleting a trip must not delete the
-- profile of everyone who happened to be viewing it.
alter table public.profiles
  add column if not exists current_trip_id uuid references public.trips(id) on delete set null;

-- ── Create a trip ────────────────────────────────────────────────────────────
--
-- Always creates, unlike the bootstrap. The caller becomes its organiser and it
-- becomes their current selection.
--
-- `p_copy_template` starts the trip from the seeded packing list; a trip built
-- from an imported itinerary usually wants that, while someone bringing their
-- own list does not.
create or replace function public.create_trip(
  p_name          text,
  p_copy_template boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_template uuid;
  v_trip     uuid;
  v_display  text;
  v_cat      record;
  v_new_cat  int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'a trip needs a name';
  end if;

  -- A cap, so a scripted caller cannot fill the table. Generous enough that no
  -- real traveller meets it.
  if (select count(*) from public.trip_members m
       where m.user_id = v_uid and m.member_key = 'organiser') >= 20 then
    raise exception 'you have reached the maximum number of trips';
  end if;

  select p.display_name into v_display from public.profiles p where p.id = v_uid;

  insert into public.trips (name, is_template, created_by)
  values (btrim(p_name), false, v_uid)
  returning id into v_trip;

  insert into public.trip_members (trip_id, user_id, member_key, display_name)
  values (v_trip, v_uid, 'organiser', v_display);

  if p_copy_template then
    select t.id into v_template from public.trips t where t.is_template order by t.created_at limit 1;
  end if;

  if v_template is not null then
    -- Row by row, not a set INSERT joined back on sort_order: sort_order is not
    -- unique within a trip and joining on it duplicates every item.
    create temporary table _new_cat_map (old_id int, new_id int) on commit drop;

    for v_cat in
      select id, name, icon, sort_order
        from public.categories where trip_id = v_template order by sort_order, id
    loop
      insert into public.categories (trip_id, name, icon, sort_order)
      values (v_trip, v_cat.name, v_cat.icon, v_cat.sort_order)
      returning id into v_new_cat;
      insert into _new_cat_map (old_id, new_id) values (v_cat.id, v_new_cat);
    end loop;

    insert into public.items
      (trip_id, category_id, name, note, qty, status, assigned_to, scope, carry_tags, sort_order, is_custom)
    select v_trip, m.new_id, i.name, i.note, i.qty, i.status, i.assigned_to, i.scope,
           i.carry_tags, i.sort_order, false
      from public.items i
      join _new_cat_map m on m.old_id = i.category_id
     where i.trip_id = v_template;

    insert into public.packed (item_id, user_key, packed)
    select i.id, 'organiser', false from public.items i where i.trip_id = v_trip and i.scope = 'each'
    union all
    select i.id, 'shared', false from public.items i where i.trip_id = v_trip and i.scope = 'shared';
  end if;

  -- Deliberately no itinerary copy: a new trip's days come from the traveller,
  -- not from someone else's route.

  update public.profiles set current_trip_id = v_trip where id = v_uid;
  return v_trip;
end;
$$;

-- ── Switch selection ─────────────────────────────────────────────────────────
--
-- Validates membership rather than trusting the id, so a crafted call cannot
-- point someone at a trip they do not belong to. RLS would hide its contents
-- anyway, but the app would then render an empty trip instead of refusing.
create or replace function public.set_current_trip(p_trip uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.trip_members m where m.trip_id = p_trip and m.user_id = v_uid
  ) then
    raise exception 'you are not a member of that trip';
  end if;

  update public.profiles set current_trip_id = p_trip where id = v_uid;
end;
$$;

revoke execute on function public.create_trip(text, boolean) from anon, public;
revoke execute on function public.set_current_trip(uuid)    from anon, public;
grant  execute on function public.create_trip(text, boolean) to authenticated;
grant  execute on function public.set_current_trip(uuid)     to authenticated;

-- Point existing accounts at the trip they already had.
update public.profiles p
   set current_trip_id = (
     select m.trip_id from public.trip_members m
      where m.user_id = p.id
      order by (m.member_key <> 'organiser'), m.created_at
      limit 1)
 where p.current_trip_id is null;
