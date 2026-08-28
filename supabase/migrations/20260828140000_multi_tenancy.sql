-- Multi-tenancy.
--
-- Until now every policy was `auth.role() = 'authenticated'`, which is correct
-- for a closed two-person app but means any new signup lands inside the single
-- existing trip with full write access. Opening registration requires real
-- per-trip scoping, which is what this migration adds.
--
-- Shape: a trip has an organiser and up to two partners. `profiles.role`
-- (globally 'kritish' or 'partner') becomes `trip_members.member_key`, scoped
-- per trip.
--
-- Vocabulary, kept deliberately distinct because these collide easily:
--   admin      — operates the deployment (profiles.app_role). Not a trip concept.
--   organiser  — signed up and created this trip.
--   partner_1  — invited into it.
--   partner_2  —      "        "
-- "owner" is avoided entirely: it reads as the owner of the application.

-- ── 1. Trips + membership ────────────────────────────────────────────────────

create table if not exists public.trips (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  depart_date       date,
  coordinator_name  text,
  coordinator_phone text,
  leader_name       text,
  leader_phone      text,
  -- The template trip is the source a new signup's trip is copied from.
  is_template       boolean not null default false,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create table if not exists public.trip_members (
  trip_id      uuid not null references public.trips(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  member_key   text not null check (member_key in ('organiser', 'partner_1', 'partner_2')),
  display_name text,
  created_at   timestamptz not null default now(),
  primary key (trip_id, user_id),
  -- One holder per slot: one organiser, at most two partners.
  unique (trip_id, member_key)
);

create index if not exists trip_members_user_idx on public.trip_members (user_id);

-- ── 2. Scope the content tables ──────────────────────────────────────────────

alter table public.categories add column if not exists trip_id uuid references public.trips(id) on delete cascade;
alter table public.items      add column if not exists trip_id uuid references public.trips(id) on delete cascade;
alter table public.itinerary  add column if not exists trip_id uuid references public.trips(id) on delete cascade;

-- ── 3. Migrate the existing single trip ──────────────────────────────────────

do $$
declare
  v_trip uuid;
begin
  -- Nothing to migrate on a fresh database.
  if not exists (select 1 from public.categories where trip_id is null)
     and not exists (select 1 from public.trip) then
    return;
  end if;

  insert into public.trips (name, depart_date, coordinator_name, coordinator_phone, leader_name, leader_phone)
  select coalesce(t.name, 'Spiti Valley'), t.depart_date,
         t.coordinator_name, t.coordinator_phone, t.leader_name, t.leader_phone
    from public.trip t
   where t.id = 1
  returning id into v_trip;

  -- No legacy trip row, but there is orphaned content: give it a home anyway.
  if v_trip is null then
    insert into public.trips (name) values ('Spiti Valley') returning id into v_trip;
  end if;

  update public.categories set trip_id = v_trip where trip_id is null;
  update public.items       set trip_id = v_trip where trip_id is null;
  update public.itinerary   set trip_id = v_trip where trip_id is null;

  -- Existing accounts become members of that trip, preserving who was who.
  insert into public.trip_members (trip_id, user_id, member_key, display_name)
  select v_trip, p.id,
         case when p.role = 'kritish' then 'organiser' else 'partner_1' end,
         p.display_name
    from public.profiles p
  on conflict do nothing;
end $$;

-- ── 4. Rename the person keys to trip slots ──────────────────────────────────

alter table public.items  drop constraint if exists items_assigned_to_check;
alter table public.items  drop constraint if exists items_scope_check;

update public.items  set assigned_to = 'organiser' where assigned_to = 'kritish';
update public.items  set assigned_to = 'partner_1' where assigned_to = 'partner';
update public.packed set user_key    = 'organiser' where user_key    = 'kritish';
update public.packed set user_key    = 'partner_1' where user_key    = 'partner';

alter table public.items
  add constraint items_assigned_to_check
    check (assigned_to in ('organiser', 'partner_1', 'partner_2', 'shared'));
alter table public.items
  add constraint items_scope_check check (scope in ('each', 'shared'));
alter table public.items alter column assigned_to set default 'shared';

alter table public.packed
  add constraint packed_user_key_check
    check (user_key in ('organiser', 'partner_1', 'partner_2', 'shared'));

-- ── 5. Lock the scoping down ─────────────────────────────────────────────────

-- Any row still unscoped at this point is orphaned content from a partial state.
delete from public.categories where trip_id is null;
delete from public.items      where trip_id is null;
delete from public.itinerary  where trip_id is null;

alter table public.categories alter column trip_id set not null;
alter table public.items      alter column trip_id set not null;
alter table public.itinerary  alter column trip_id set not null;

-- `day` was the itinerary primary key, which collides across trips.
alter table public.itinerary drop constraint if exists itinerary_pkey;
alter table public.itinerary add primary key (trip_id, day);

create index if not exists categories_trip_idx on public.categories (trip_id);
create index if not exists items_trip_idx      on public.items (trip_id);

-- ── 6. Retire the old policies ───────────────────────────────────────────────
--
-- This must happen before profiles.role is dropped: the legacy packed policies
-- select from profiles.role, and Postgres refuses to drop a column a policy
-- depends on.

drop policy if exists "categories: authed all"  on public.categories;
drop policy if exists "items: authed all"       on public.items;
drop policy if exists "packed: authed all"      on public.packed;
drop policy if exists "packed: authed select"   on public.packed;
drop policy if exists "packed: insert own"      on public.packed;
drop policy if exists "packed: update own"      on public.packed;
drop policy if exists "packed: delete own"      on public.packed;
drop policy if exists "itinerary: authed all"   on public.itinerary;
drop policy if exists "itinerary: authed read"  on public.itinerary;
drop policy if exists "profiles: authed read"   on public.profiles;

-- ── 7. profiles.role is now per-trip, not global ─────────────────────────────

drop trigger if exists profiles_prevent_role_change on public.profiles;
drop function if exists public.prevent_role_change();
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop column if exists role;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, color)
  values (
    new.id,
    coalesce(new.raw_app_meta_data->>'display_name',
             new.raw_user_meta_data->>'display_name',
             split_part(new.email, '@', 1)),
    coalesce(new.raw_app_meta_data->>'color', 'accent')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── 8. Membership predicate used by every policy ─────────────────────────────

-- SECURITY DEFINER so policies on trip_members itself do not recurse.
create or replace function public.is_trip_member(p_trip uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.trip_members m
     where m.trip_id = p_trip and m.user_id = auth.uid()
  );
$$;

revoke execute on function public.is_trip_member(uuid) from anon, public;
grant  execute on function public.is_trip_member(uuid) to authenticated;

-- ── 9. Install membership-scoped policies ────────────────────────────────────

alter table public.trips        enable row level security;
alter table public.trip_members enable row level security;

-- trips: members read; the template is readable by any signed-in user so a new
-- account can copy it. Only the creator may change a trip.
create policy "trips: member read" on public.trips for select
  using (is_template or public.is_trip_member(id));
create policy "trips: creator write" on public.trips for update
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "trips: creator insert" on public.trips for insert
  with check (created_by = auth.uid() and not is_template);
create policy "trips: creator delete" on public.trips for delete
  using (created_by = auth.uid());

-- trip_members: you see the membership rows of trips you belong to.
create policy "trip_members: member read" on public.trip_members for select
  using (public.is_trip_member(trip_id));
create policy "trip_members: creator manage" on public.trip_members for all
  using (exists (select 1 from public.trips t where t.id = trip_id and t.created_by = auth.uid()))
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.created_by = auth.uid()));

-- profiles: only your own row, plus anyone sharing a trip with you.
create policy "profiles: self or co-member read" on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.trip_members mine
      join public.trip_members theirs on theirs.trip_id = mine.trip_id
      where mine.user_id = auth.uid() and theirs.user_id = public.profiles.id
    )
  );

create policy "categories: member all" on public.categories for all
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

create policy "items: member all" on public.items for all
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

-- itinerary stays read-only to clients; seeding happens with the service role.
create policy "itinerary: member read" on public.itinerary for select
  using (public.is_trip_member(trip_id));

-- packed has no trip_id of its own — it inherits scope from its item. Reads are
-- open to the whole trip (both progress bars need it); writes stay pinned to the
-- caller's own key or the shared row.
create policy "packed: member read" on public.packed for select
  using (exists (select 1 from public.items i where i.id = packed.item_id and public.is_trip_member(i.trip_id)));

create policy "packed: member insert" on public.packed for insert
  with check (
    exists (
      select 1 from public.items i
       join public.trip_members m on m.trip_id = i.trip_id and m.user_id = auth.uid()
      where i.id = packed.item_id
        and (packed.user_key = 'shared' or packed.user_key = m.member_key)
    )
  );

create policy "packed: member update" on public.packed for update
  using (exists (
    select 1 from public.items i
     join public.trip_members m on m.trip_id = i.trip_id and m.user_id = auth.uid()
    where i.id = packed.item_id
      and (packed.user_key = 'shared' or packed.user_key = m.member_key)))
  with check (exists (
    select 1 from public.items i
     join public.trip_members m on m.trip_id = i.trip_id and m.user_id = auth.uid()
    where i.id = packed.item_id
      and (packed.user_key = 'shared' or packed.user_key = m.member_key)));

create policy "packed: member delete" on public.packed for delete
  using (exists (
    select 1 from public.items i
     join public.trip_members m on m.trip_id = i.trip_id and m.user_id = auth.uid()
    where i.id = packed.item_id
      and (packed.user_key = 'shared' or packed.user_key = m.member_key)));

-- ── 10. The legacy singleton trip table is superseded ────────────────────────

drop table if exists public.trip;
