-- Partner invitations.
--
-- An organiser invites up to two partners into their trip. There is no mail
-- provider wired into this deployment, so an invite produces an unguessable link
-- the organiser shares themselves — honest about what it can actually do, and it
-- works offline of any email configuration.
--
-- Slots: 'partner_1' then 'partner_2'. A slot is occupied by a member or held by
-- a pending invite, so two people cannot land in the same one.

create table if not exists public.trip_invites (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  member_key  text not null check (member_key in ('partner_1', 'partner_2')),
  email       text,
  -- 64 hex chars (256 bits) from two gen_random_uuid() calls. Built into core
  -- Postgres, so a self-hosted clone needs no pgcrypto. This token is the only
  -- thing protecting the trip, so it is never derived from the trip or invitee id.
  token       text not null unique
              default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null
);

create index if not exists trip_invites_trip_idx on public.trip_invites (trip_id);
-- At most one live invite per slot; revoked/accepted rows stay for history.
create unique index if not exists trip_invites_pending_slot_idx
  on public.trip_invites (trip_id, member_key) where status = 'pending';

alter table public.trip_invites enable row level security;

-- Members of a trip can see its invites; only the trip's creator can issue or
-- revoke them. The invitee reads nothing here — acceptance goes through the
-- SECURITY DEFINER function below, since they are not a member yet.
create policy "trip_invites: member read" on public.trip_invites for select
  using (public.is_trip_member(trip_id));

create policy "trip_invites: creator write" on public.trip_invites for all
  using (exists (select 1 from public.trips t where t.id = trip_id and t.created_by = auth.uid()))
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.created_by = auth.uid()));

-- ── Issue ────────────────────────────────────────────────────────────────────

create or replace function public.create_trip_invite(p_email text default null)
returns table (invite_id uuid, token text, member_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_trip uuid;
  v_slot text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select m.trip_id into v_trip
    from public.trip_members m
   where m.user_id = v_uid and m.member_key = 'organiser'
   limit 1;
  if v_trip is null then
    raise exception 'only a trip organiser can invite partners';
  end if;

  -- First slot that is neither filled by a member nor held by a live invite.
  select s.k into v_slot
    from (values ('partner_1'), ('partner_2')) as s(k)
   where not exists (
           select 1 from public.trip_members m
            where m.trip_id = v_trip and m.member_key = s.k)
     and not exists (
           select 1 from public.trip_invites i
            where i.trip_id = v_trip and i.member_key = s.k and i.status = 'pending')
   order by s.k
   limit 1;

  if v_slot is null then
    raise exception 'this trip already has two partners';
  end if;

  return query
  insert into public.trip_invites (trip_id, member_key, email, invited_by)
  values (v_trip, v_slot, nullif(btrim(p_email), ''), v_uid)
  returning public.trip_invites.id, public.trip_invites.token, public.trip_invites.member_key;
end;
$$;

-- ── Accept ───────────────────────────────────────────────────────────────────

-- SECURITY DEFINER because the invitee is, by definition, not yet a member and
-- so cannot read the invite or the trip under RLS. Every check the policies would
-- have made is therefore made explicitly here.
create or replace function public.accept_trip_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_invite public.trip_invites%rowtype;
  v_name   text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_invite
    from public.trip_invites
   where token = p_token
   for update;

  if v_invite.id is null then raise exception 'invite not found'; end if;

  -- Membership is checked FIRST so someone who already joined and re-opens their
  -- link gets a quiet no-op rather than "no longer valid". Checked before status
  -- precisely because accepting flips status to 'accepted'.
  if exists (select 1 from public.trip_members m
              where m.trip_id = v_invite.trip_id and m.user_id = v_uid) then
    return v_invite.trip_id;
  end if;

  if v_invite.status <> 'pending' then raise exception 'this invite is no longer valid'; end if;
  if v_invite.expires_at < now()  then raise exception 'this invite has expired'; end if;

  -- The slot could have been filled between issuing and accepting.
  if exists (select 1 from public.trip_members m
              where m.trip_id = v_invite.trip_id and m.member_key = v_invite.member_key) then
    raise exception 'that place in the trip has already been taken';
  end if;

  select p.display_name into v_name from public.profiles p where p.id = v_uid;

  insert into public.trip_members (trip_id, user_id, member_key, display_name)
  values (v_invite.trip_id, v_uid, v_invite.member_key, v_name);

  update public.trip_invites
     set status = 'accepted', accepted_at = now(), accepted_by = v_uid
   where id = v_invite.id;

  return v_invite.trip_id;
end;
$$;

-- ── Preview ──────────────────────────────────────────────────────────────────

-- Lets the accept screen show who invited them before they commit, without
-- exposing the trip's contents.
create or replace function public.peek_trip_invite(p_token text)
returns table (trip_name text, invited_by_name text, status text, expired boolean)
language sql
security definer
stable
set search_path = ''
as $$
  select t.name,
         coalesce(p.display_name, 'A YakPack user'),
         i.status,
         i.expires_at < now()
    from public.trip_invites i
    join public.trips t on t.id = i.trip_id
    left join public.profiles p on p.id = i.invited_by
   where i.token = p_token;
$$;

revoke execute on function public.create_trip_invite(text)  from anon, public;
revoke execute on function public.accept_trip_invite(text)  from anon, public;
revoke execute on function public.peek_trip_invite(text)    from anon, public;
grant  execute on function public.create_trip_invite(text)  to authenticated;
grant  execute on function public.accept_trip_invite(text)  to authenticated;
grant  execute on function public.peek_trip_invite(text)    to authenticated;
