-- Both users need to see the full pack state for M3 realtime sync + M5 per-person progress bars.
-- Keep writes gated to own user_key; open SELECT to any authenticated user.
drop policy "packed: select own" on public.packed;

create policy "packed: authed select"
  on public.packed for select
  using (auth.role() = 'authenticated');
