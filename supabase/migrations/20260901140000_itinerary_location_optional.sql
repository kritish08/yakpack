-- A day is allowed to have no location.
--
-- itinerary.lat/lon were NOT NULL from the era when the only itinerary was the
-- seeded Spiti one, where every day had been looked up by hand. Since then two
-- features write days that legitimately have no coordinates:
--
--   * "Import a plan" resolves place names through Open-Meteo and asks the user
--     to accept each match. Declining leaves lat/lon null — that is the whole
--     point of the confirmation step, because the geocoder puts "Kaza" in Russia.
--   * Building a trip by hand types altitudes directly and never geocodes.
--
-- Both then failed on insert with "null value in column lat violates not-null
-- constraint", which surfaced as a save that simply did not happen.
--
-- The readers were already written for this: the Plan screen skips weather for a
-- day with no lat, and the AMS logic keys off altitude, not position. The
-- constraint was the only thing insisting otherwise.
alter table public.itinerary alter column lat drop not null;
alter table public.itinerary alter column lon drop not null;
