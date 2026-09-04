-- Realtime publication membership.
--
-- `packed` was enabled through the Supabase dashboard rather than a migration,
-- so it was invisible to this repo and unreproducible on a fresh project. The
-- Summary screen also needs `items` (mark-bought / add / edit) and `categories`
-- (category CRUD) to broadcast, otherwise its subscription silently never fires.
--
-- Idempotent: `alter publication ... add table` errors if the table is already a
-- member, so each is guarded on pg_publication_tables.
do $$
declare
  t text;
begin
  foreach t in array array['packed', 'items', 'categories'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
