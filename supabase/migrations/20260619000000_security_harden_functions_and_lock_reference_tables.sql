-- Security hardening (applied via Supabase migration on 2026-06-19)
-- Clears Supabase security-advisor findings and tightens RLS on seeded data.

-- 1. Pin search_path on prevent_role_change (references no schema objects → '' is safe)
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role <> old.role then
    raise exception 'profiles.role is immutable after creation';
  end if;
  return new;
end;
$$;

-- 2. Remove PostgREST RPC exposure of the trigger functions.
--    Triggers still fire (trigger execution does not check EXECUTE grants);
--    this only blocks direct /rest/v1/rpc/* calls by anon/authenticated.
revoke execute on function public.prevent_role_change() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- 3. Lock seeded reference data to read-only for clients.
--    itinerary + trip are written only by the seed/restore scripts via the
--    service role, which bypasses RLS. Clients only ever read them.
drop policy if exists "itinerary: authed all" on public.itinerary;
create policy "itinerary: authed read"
  on public.itinerary for select
  using (auth.role() = 'authenticated');

drop policy if exists "trip: authed all" on public.trip;
create policy "trip: authed read"
  on public.trip for select
  using (auth.role() = 'authenticated');
