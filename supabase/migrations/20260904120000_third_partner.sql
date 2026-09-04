-- A trip holds four people: an organiser and up to three partners.
--
-- It held three. The cap lived in four places — two CHECK constraints, the
-- invite table's own constraint, and the slot list inside create_trip_invite()
-- — and every one of them has to move together, or an invite is issued for a
-- slot the membership table then refuses.
--
-- Purely widening. No existing row becomes invalid, so this is safe to apply to
-- a live database with trips already in it.

alter table public.trip_members  drop constraint if exists trip_members_member_key_check;
alter table public.trip_members  add  constraint trip_members_member_key_check
  check (member_key in ('organiser', 'partner_1', 'partner_2', 'partner_3'));

alter table public.packed        drop constraint if exists packed_user_key_check;
alter table public.packed        add  constraint packed_user_key_check
  check (user_key in ('organiser', 'partner_1', 'partner_2', 'partner_3', 'shared'));

alter table public.trip_invites  drop constraint if exists trip_invites_member_key_check;
alter table public.trip_invites  add  constraint trip_invites_member_key_check
  check (member_key in ('partner_1', 'partner_2', 'partner_3'));

-- Only the slot list and the error message change; the "first slot held by
-- neither a member nor a live invite" rule already generalises. The signature is
-- reproduced exactly — Postgres refuses to replace a function whose OUT columns
-- differ, and inventing a new return shape here would mean dropping a function
-- the app calls.
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
    from (values ('partner_1'), ('partner_2'), ('partner_3')) as s(k)
   where not exists (
           select 1 from public.trip_members m
            where m.trip_id = v_trip and m.member_key = s.k)
     and not exists (
           select 1 from public.trip_invites i
            where i.trip_id = v_trip and i.member_key = s.k and i.status = 'pending')
   order by s.k
   limit 1;

  if v_slot is null then
    raise exception 'this trip already has three partners';
  end if;

  return query
  insert into public.trip_invites (trip_id, member_key, email, invited_by)
  values (v_trip, v_slot, nullif(btrim(p_email), ''), v_uid)
  returning public.trip_invites.id, public.trip_invites.token, public.trip_invites.member_key;
end;
$$;

revoke execute on function public.create_trip_invite(text) from anon, public;
grant  execute on function public.create_trip_invite(text) to authenticated;
