-- Application roles: admin vs user.
--
-- Distinct from `trip_members.member_key`. That is identity *within one trip*
-- (owner / partner). This is standing *in the application*: an admin is a normal
-- user who additionally operates the deployment. Someone is simultaneously the
-- 'owner' of their trip and an 'admin' of the install, or 'owner' and 'user'.
--
-- Two things follow from being an admin:
--   1. Pemba may fall back to the deployment's own OPENAI_API_KEY. Everyone else
--      must bring their own key, so a stranger signing up cannot spend the
--      operator's credits.
--   2. Access to a small user-management panel.

alter table public.profiles
  add column if not exists app_role text not null default 'user';

alter table public.profiles drop constraint if exists profiles_app_role_check;
alter table public.profiles
  add constraint profiles_app_role_check check (app_role in ('admin', 'user'));

-- ── Self-promotion guard ─────────────────────────────────────────────────────
--
-- `profiles: owner write` lets a user update their own row, which without this
-- would include handing themselves app_role='admin'. SECURITY INVOKER on purpose
-- so current_user is the caller's role, letting the service role through for
-- legitimate administration.
create or replace function public.prevent_app_role_change()
returns trigger
language plpgsql
as $$
begin
  -- Privileged roles are the legitimate administration path: the service role
  -- (admin panel server actions) and the migration roles. A signed-in user is
  -- 'authenticated' and never passes.
  if new.app_role is distinct from old.app_role
     and current_user not in ('service_role', 'postgres', 'supabase_admin')
     and coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
  then
    raise exception 'app_role may only be changed by an administrator';
  end if;
  return new;
end;
$$;

-- ── Predicate ────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (select p.app_role = 'admin' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke execute on function public.is_admin() from anon, public;
grant  execute on function public.is_admin() to authenticated;

-- Admins can see every profile, so the management panel can list accounts.
drop policy if exists "profiles: admin read" on public.profiles;
create policy "profiles: admin read" on public.profiles for select
  using (public.is_admin());

-- ── Bootstrap ────────────────────────────────────────────────────────────────
--
-- The earliest account becomes the admin when none exists yet. On a fresh
-- self-hosted install that is whoever set it up; here it is the original owner.
-- Deliberately not a hardcoded UUID, so this works on any deployment.
do $$
begin
  if not exists (select 1 from public.profiles where app_role = 'admin') then
    update public.profiles
       set app_role = 'admin'
     where id = (select id from public.profiles order by created_at, id limit 1);
  end if;
end $$;

-- Installed last: the guard would otherwise block the bootstrap update above.
drop trigger if exists profiles_prevent_app_role_change on public.profiles;
create trigger profiles_prevent_app_role_change
  before update on public.profiles
  for each row execute function public.prevent_app_role_change();

revoke execute on function public.prevent_app_role_change() from anon, authenticated, public;
