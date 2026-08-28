-- Let an organiser write their own itinerary.
--
-- `itinerary` was locked to SELECT when the only writer was the service-role
-- seed script and there was a single, curated trip. Now that anyone can create a
-- trip and import a plan into it, its organiser has to be able to write the days
-- — otherwise saving a plan fails against RLS with nothing in the UI to explain
-- why.
--
-- Partners stay read-only: the plan is the organiser's to set, and they can
-- still see every day of it through the existing read policy. Permissive
-- policies are OR'd, so adding this does not narrow anyone's read access.

drop policy if exists "itinerary: organiser write" on public.itinerary;
create policy "itinerary: organiser write" on public.itinerary for all
  using (
    exists (
      select 1 from public.trip_members m
       where m.trip_id = itinerary.trip_id
         and m.user_id = auth.uid()
         and m.member_key = 'organiser'
    )
  )
  with check (
    exists (
      select 1 from public.trip_members m
       where m.trip_id = itinerary.trip_id
         and m.user_id = auth.uid()
         and m.member_key = 'organiser'
    )
  );
