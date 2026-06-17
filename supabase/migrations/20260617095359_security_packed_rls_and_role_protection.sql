-- Fix 1: Constrain packed.user_key to caller's own role or 'shared'
drop policy "packed: authed all" on public.packed;

create policy "packed: select own"
  on public.packed for select
  using (
    user_key = 'shared'
    or user_key = (select role from public.profiles where id = auth.uid())
  );

create policy "packed: insert own"
  on public.packed for insert
  with check (
    user_key = 'shared'
    or user_key = (select role from public.profiles where id = auth.uid())
  );

create policy "packed: update own"
  on public.packed for update
  using (
    user_key = 'shared'
    or user_key = (select role from public.profiles where id = auth.uid())
  )
  with check (
    user_key = 'shared'
    or user_key = (select role from public.profiles where id = auth.uid())
  );

create policy "packed: delete own"
  on public.packed for delete
  using (
    user_key = 'shared'
    or user_key = (select role from public.profiles where id = auth.uid())
  );

-- Fix 2: Prevent profiles.role from being changed after creation
create or replace function public.prevent_role_change()
returns trigger language plpgsql security definer as $$
begin
  if new.role <> old.role then
    raise exception 'profiles.role is immutable after creation';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();
