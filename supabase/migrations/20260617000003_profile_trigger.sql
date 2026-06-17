-- Auto-create a profiles row whenever a new auth.users row is inserted.
-- The role and display_name come from raw_app_meta_data set at user creation.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role, color)
  values (
    new.id,
    coalesce(new.raw_app_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_app_meta_data->>'role', 'partner'),
    coalesce(new.raw_app_meta_data->>'color', 'accent')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
