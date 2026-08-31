-- Trip contacts, generalised.
--
-- `trips` carried four columns — coordinator_name/phone, leader_name/phone —
-- lifted straight off the first trip's operator PDF. That shape is one tour
-- package's org chart, not a property of travel: a self-drive trip has no
-- coordinator, a trek has a guide and a permit office, a city trip has a hotel
-- desk and an airline. Two fixed slots means every other trip either leaves them
-- blank or abuses them as free text.
--
-- So contacts become rows. A trip carries as many as it needs, each with its own
-- role label, and the first trip's coordinator/leader pair is simply one
-- instance of that format rather than the schema itself.

create table if not exists public.trip_contacts (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  -- What this person is to the trip: "Trip coordinator", "Driver", "Homestay",
  -- "Insurance". Free text, because the useful set differs per trip.
  role       text not null,
  name       text,
  phone      text,
  note       text,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists trip_contacts_trip_idx on public.trip_contacts (trip_id, sort_order, created_at);

-- ── Carry the existing pairs across before the columns go ────────────────────
--
-- Guarded on the columns still existing so a re-run — or a fresh database where
-- this migration is the first to create the table — is a no-op rather than an
-- error.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'trips' and column_name = 'coordinator_name'
  ) then
    insert into public.trip_contacts (trip_id, role, name, phone, sort_order)
    select t.id, 'Trip coordinator', t.coordinator_name, t.coordinator_phone, 0
      from public.trips t
     where coalesce(t.coordinator_name, t.coordinator_phone) is not null;

    insert into public.trip_contacts (trip_id, role, name, phone, sort_order)
    select t.id, 'Trip leader', t.leader_name, t.leader_phone, 1
      from public.trips t
     where coalesce(t.leader_name, t.leader_phone) is not null;
  end if;
end $$;

alter table public.trips drop column if exists coordinator_name;
alter table public.trips drop column if exists coordinator_phone;
alter table public.trips drop column if exists leader_name;
alter table public.trips drop column if exists leader_phone;

-- ── RLS ──────────────────────────────────────────────────────────────────────
--
-- Read for anyone in the trip; write for its organiser only, matching
-- `itinerary`. A partner needs the driver's number on the road far more than
-- they need to edit it, and permissive policies are OR'd so the write policy
-- does not narrow the read.
alter table public.trip_contacts enable row level security;

drop policy if exists "trip_contacts: member read"   on public.trip_contacts;
drop policy if exists "trip_contacts: organiser write" on public.trip_contacts;

create policy "trip_contacts: member read" on public.trip_contacts for select
  using (public.is_trip_member(trip_id));

create policy "trip_contacts: organiser write" on public.trip_contacts for all
  using (
    exists (
      select 1 from public.trip_members m
       where m.trip_id = trip_contacts.trip_id
         and m.user_id = auth.uid()
         and m.member_key = 'organiser'
    )
  )
  with check (
    exists (
      select 1 from public.trip_members m
       where m.trip_id = trip_contacts.trip_id
         and m.user_id = auth.uid()
         and m.member_key = 'organiser'
    )
  );

grant select, insert, update, delete on public.trip_contacts to authenticated;

-- ── Copy contacts where the route already copies ─────────────────────────────
--
-- Rule: the packing list copies from the template in both creation paths, while
-- route data — the itinerary and the people along it — copies only in the signup
-- bootstrap, where the point is a populated trip to explore. A trip you create
-- yourself starts with your own days and your own numbers, because someone
-- else's driver is not your driver.
--
-- Only the tail of create_trip_from_template() changes; it is restated whole
-- because Postgres has no way to patch a function body.
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
