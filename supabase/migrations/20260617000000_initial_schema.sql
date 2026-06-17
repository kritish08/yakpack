-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('kritish','partner')),
  color text not null default 'accent',
  created_at timestamptz default now()
);

-- categories
create table if not exists public.categories (
  id serial primary key,
  name text not null,
  icon text,
  sort_order int not null
);

-- items
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  category_id int not null references public.categories(id) on delete cascade,
  name text not null,
  note text,
  qty text,
  status text not null default 'standard'
    check (status in ('owned','to_buy','standard')),
  assigned_to text not null default 'shared'
    check (assigned_to in ('kritish','partner','shared')),
  scope text not null default 'shared'
    check (scope in ('each','shared')),
  carry_tags text[] default '{}',
  sort_order int not null default 0,
  is_custom boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- packed
create table if not exists public.packed (
  item_id uuid not null references public.items(id) on delete cascade,
  user_key text not null,
  packed boolean not null default false,
  packed_at timestamptz,
  primary key (item_id, user_key)
);

-- itinerary
create table if not exists public.itinerary (
  day int primary key,
  date date,
  leg text not null,
  lat double precision not null,
  lon double precision not null,
  altitude_m int,
  highlights text,
  carry_today text[] default '{}',
  prep_tonight text,
  warnings text,
  network text check (network in ('good','weak','none','patchy')),
  fun text,
  tip text
);

-- trip (singleton)
create table if not exists public.trip (
  id int primary key default 1,
  name text,
  depart_date date,
  coordinator_name text,
  coordinator_phone text,
  leader_name text,
  leader_phone text
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.profiles  enable row level security;
alter table public.categories enable row level security;
alter table public.items     enable row level security;
alter table public.packed    enable row level security;
alter table public.itinerary enable row level security;
alter table public.trip      enable row level security;

-- profiles: readable by any authenticated user; writable only by the owner
create policy "profiles: authed read"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "profiles: owner write"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- categories, items, packed, itinerary, trip: full access for authenticated users
create policy "categories: authed all"
  on public.categories for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "items: authed all"
  on public.items for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "packed: authed all"
  on public.packed for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "itinerary: authed all"
  on public.itinerary for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "trip: authed all"
  on public.trip for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
