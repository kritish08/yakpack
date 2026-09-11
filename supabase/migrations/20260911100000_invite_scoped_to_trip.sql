-- Scope an invite to the trip it was issued from.
--
-- create_trip_invite() picked the caller's organiser membership with `limit 1`
-- and no ordering. While an account could only organise one trip that was the
-- only row, so it was right by accident. Since multiple trips landed it is an
-- arbitrary one -- and every other part of the panel reads the *active* trip,
-- which honours profiles.current_trip_id. So an organiser of two trips could be
-- shown one trip's free slots and mint a link into the other, which
-- revoke_invite -- correctly trip-scoped -- then could not cancel.
--
-- The trip is now a parameter rather than a guess. It is resolved server-side
-- from the session in app/actions/invites.ts and never taken from the client,
-- and this function re-checks that the caller organises *that* trip: the
-- function is SECURITY DEFINER, so it runs past RLS, and that check is the only
-- thing between a crafted trip id and somebody else's trip.
--
-- The old single-argument form is dropped rather than left beside the new one.
-- Leaving it would keep the defect reachable by anyone calling the RPC without
-- the new argument, and PostgREST would happily resolve to it.

drop function if exists public.create_trip_invite(text);

create or replace function public.create_trip_invite(
  p_trip_id uuid,
  p_email   text default null
)
returns table (invite_id uuid, token text, member_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_slot text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.trip_members m
     where m.trip_id   = p_trip_id
       and m.user_id   = v_uid
       and m.member_key = 'organiser'
  ) then
    raise exception 'only a trip organiser can invite partners';
  end if;

  -- First slot that is neither filled by a member nor held by a live invite.
  -- Unchanged rule; it just reads p_trip_id now instead of a trip it chose.
  select s.k into v_slot
    from (values ('partner_1'), ('partner_2'), ('partner_3')) as s(k)
   where not exists (
           select 1 from public.trip_members m
            where m.trip_id = p_trip_id and m.member_key = s.k)
     and not exists (
           select 1 from public.trip_invites i
            where i.trip_id = p_trip_id and i.member_key = s.k and i.status = 'pending')
   order by s.k
   limit 1;

  if v_slot is null then
    raise exception 'this trip already has three partners';
  end if;

  return query
  insert into public.trip_invites (trip_id, member_key, email, invited_by)
  values (p_trip_id, v_slot, nullif(btrim(p_email), ''), v_uid)
  returning public.trip_invites.id, public.trip_invites.token, public.trip_invites.member_key;
end;
$$;

revoke execute on function public.create_trip_invite(uuid, text) from anon, public;
grant  execute on function public.create_trip_invite(uuid, text) to authenticated;
