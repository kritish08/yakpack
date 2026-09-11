# YakPack

An offline-first trip companion — packing list, itinerary, and shared progress for a group of up to four — running at [yakpack.tech](https://yakpack.tech).

I built it for a nine-day drive into the Spiti Valley. The route starts at 216 m and tops out at 4,590 m on Kunzum pass, and the itinerary's own notes record two days where the signal is "near-zero" and then gone entirely (`docs/02_itinerary.md:99`, `:112`). That forced two requirements which then shaped everything else: offline had to mean *writes* worked offline, not merely that cached pages rendered; and the altitude figure had to be correct, because it feeds an acute-mountain-sickness warning, which makes a confidently wrong number worse than a missing one.

## Architecture, and why

### A service worker that must not cache the framework's own navigation

The obvious service worker has a catch-all branch: try the network, fall back to the cache, and cache whatever comes back. I wrote that one. It broke the app in both directions, and the online direction was the surprising one.

Next's client-side navigation is not a document navigation. It is a `fetch` carrying an `RSC: 1` header and a `?_rsc=<hash>` query parameter, and `request.mode === 'navigate'` is false for it. So it misses every handler written to recognise a page load and lands in the catch-all instead.

Once it lands there, two things go wrong:

1. `_rsc` is a deterministic hash of the router state, not a nonce. The same screen produces the same URL every time, so one cached entry is replayed forever. Screens went permanently stale *with a working connection*, and `revalidatePath()` had no visible effect, because the server's fresh response was never the one being read.
2. When an RSC fetch fails, Next falls back to a full-page navigation. That request *does* have `request.mode === 'navigate'`, and the document handler serves it from `PAGE_CACHE`. Letting the RSC fetch fail is the mechanism that makes offline navigation work at all. Caching it removes the failure, and with it the fallback.

The guard is one predicate, `isRscRequest` at [`public/sw.js:93`](public/sw.js#L93):

```js
function isRscRequest(request, url) {
  return request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')
}
```

It sits at the top of the fetch handler, ahead of every branch that could otherwise claim the request:

```
fetch
 |-- method !== GET ............................ pass through
 |-- non-http(s) protocol ...................... pass through
 |-- IS_DEV .................................... pass through
 |-- isRscRequest() ............................ pass through   <-- the guard
 |-- Supabase /rest/v1/* ....................... network-first -> DATA_CACHE
 |-- /api/weather .............................. network-first -> WEATHER_CACHE
 |-- other /api/* .............................. pass through
 |-- /_next/static/*, /icons/* ................. cache-first  -> STATIC_CACHE
 `-- request.mode === 'navigate' ............... network-first -> PAGE_CACHE -> /offline
```

**What it cost.** Offline navigation is deliberately the slow kind. There is no soft navigation without a connection — every offline route change is a full document load out of `PAGE_CACHE`, with the flash that implies. The faster behaviour was available, and it is the one that shipped broken.

There is a second cost in development. The worker is not registered under `next dev` at all, and any registration from an earlier run is torn down ([`components/sw-register.tsx:14`](components/sw-register.tsx#L14)), because Turbopack reuses `/_next/static/*` paths across rebuilds — so the cache-first rule pins stale code at a live URL and hydration dies with a black screen. That means the caching layer is never exercised locally by simply running the dev server.

### Isolation lives in Postgres, not in the application

The obvious approach is to put `.eq('trip_id', tripId)` on every query and review carefully. One forgotten filter then exposes another group's trip.

Instead every table carries row-level security, and the policies resolve through a `SECURITY DEFINER` predicate, `is_trip_member(trip_id)` — definer rights specifically so that a policy on `trip_members` does not recurse into itself while checking membership. `packed` has no `trip_id` of its own: it inherits scope from its item and writes are additionally pinned to the caller's own slot or to `'shared'` ([`supabase/migrations/20260828140000_multi_tenancy.sql:234`](supabase/migrations/20260828140000_multi_tenancy.sql#L234)). The application still filters by `trip_id` as well, but that filter is now about getting the right answer, not about safety.

I tested what this actually yields. Against a local stack with two accounts and two trips, acting as user B holding trip A's real UUID, with a positive control to prove the session was really B:

| Attempt | Result |
|---|---|
| Read own trip (control) | 1 row |
| Read trip A's items | **0 rows** |
| Read trip A's own row | **0 rows** |
| Insert an item into trip A | `ERROR: new row violates row-level security policy for table "items"` |
| Insert self into trip A as `partner_1` | `ERROR: new row violates row-level security policy for table "trip_members"` |
| Set own `app_role` to `admin` | `ERROR: app_role may only be changed by an administrator` |
| Rename own profile | succeeds; `app_role` still `user` |

The distinction in the first rows matters: a read is not refused, it returns **nothing**. There is no 403 to catch and no error to distinguish "does not exist" from "belongs to someone else", which is the behaviour worth having — but it means a bug that drops the application-level filter looks like empty state rather than like a failure.

The last two rows are a trigger rather than a policy. `app_role` is what separates operating the deployment from organising a trip, and a signed-in user updating their own profile row must not be able to grant it. `prevent_app_role_change()` is `BEFORE UPDATE ... FOR EACH ROW` and raises unless `current_user` is one of `service_role`, `postgres`, or `supabase_admin` ([`supabase/migrations/20260828180000_app_roles.sql:27`](supabase/migrations/20260828180000_app_roles.sql#L27)). A signed-in user is `authenticated` and never qualifies. It is scoped to the one column, which is why renaming a profile still works.

**What it cost.** The rules are invisible from the application code — nothing in a server action says why a write failed, and the error surfaces as a generic RLS violation with no indication of which of the twenty-one policies refused it. Testing them requires a running Postgres, so none of this is covered by the test suite, which is why I checked it by hand against a live database rather than claiming it.

### Two functions racing to create the same row

`create_trip_from_template()` guards itself by looking for an existing organiser membership and returning early. That is correct for sequential calls — a retried registration mints nothing extra — and useless for concurrent ones. In the App Router a layout and its page render *concurrently*, and both called the same resolver in one request. Both read "no membership", both passed the guard, and one signup produced two identical trips, each with `member_key = 'organiser'`.

The obvious fix is a unique index. It cannot be used here: organising several trips is a legitimate thing to do later, so the constraint is not "one organiser membership per user" — it is "the *bootstrap* happens once", and an index cannot express a rule about which code path is asking.

So the function takes a transaction-scoped advisory lock keyed on the user, then re-reads ([`supabase/migrations/20260901120000_bootstrap_concurrency.sql:39`](supabase/migrations/20260901120000_bootstrap_concurrency.sql#L39)):

```sql
perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

-- Re-check after the lock: the caller we queued behind may have just done it.
select m.trip_id into v_trip
  from public.trip_members m
 where m.user_id = v_uid and m.member_key = 'organiser'
 limit 1;
if v_trip is not null then
  return v_trip;
end if;
```

The second caller blocks until the first commits, then sees the membership and returns the same trip. Transaction scope means the lock is released on commit or rollback with nothing to release by hand, and keying on the user id means two different signups never wait on each other.

**What it cost.** A declarative guarantee became a procedural one. A unique index holds against every writer unconditionally, including a future code path, a migration, or someone at a `psql` prompt. This holds only for callers who go through this function and take the lock. The invariant now lives inside a function body, where it has to be remembered.

### Offline writes that are never rolled back

The packing screen queued failed writes. The shopping screen used server actions — which are POSTs, so they simply fail without a connection — and on failure it rolled the optimistic update back. An item ticked off in a shop with one bar of signal reappeared on the list a moment later. The app contradicting the bag in the user's hand is worse than the app being slow.

Both screens now keep the optimistic state and queue the write to a localStorage outbox ([`lib/offline-queue.ts:166`](lib/offline-queue.ts#L166)). Two details around the queue matter more than the queue itself:

- Entries written under the outbox's **previous** storage key are drained on read rather than ignored. Someone who checked items off offline and then received an app update would otherwise watch them disappear — precisely the failure the outbox exists to prevent.
- Each screen projects the pending queue over its server-rendered rows before painting. Offline, the page HTML comes from `PAGE_CACHE` and carries the snapshot from *before* the toggles, so without that projection a reload puts every completed item back.

On conflicting writes there is no merge and no causality tracking. A queued `packed` op replays as an upsert on `(item_id, user_key)`, so the last writer to reach Postgres wins the row, and Supabase Realtime then pushes the winning state to the other phone. That is acceptable here because the unit of conflict is one person's checkbox on one item: `scope='each'` items give each member their own row, so two people cannot collide on one, and `'shared'` items are a single row where both members are asserting the same fact — that the thing is packed.

**What it cost.** Convergence. State that never rolls back can stay wrong indefinitely, and this implementation has not paid that bill. A replay that fails is pushed back onto the queue and retried on every mount and every `online` event, with no attempt counter, no age limit, and no dead-letter path — so an op that can *never* succeed is retried forever. The two branches are also inconsistent about it: a `status` op filtered out by RLS matches zero rows, reports no error, and is silently discarded, while a refused `packed` upsert returns an error and is kept permanently.

### A geocoder that is wrong more often than it is right

Altitude drives the AMS warning, so the number has to be right. Open-Meteo's geocoding is free, keyless, and already the weather source, and it is close to useless on these names taken one at a time: "Kaza" resolves to Kazan in Russia at 61 m against a true 3,800 m, "Tabo" to Ivory Coast, "Manali" to a place in Tamil Nadu at 6 m. Resolving each name independently got **one of five** right. The obvious remedies — a paid geocoder, or a hand-maintained lookup table — both fail the constraint that this has to work for a trip I have never seen.

An itinerary is not a list of names, though. It is a *route*, and a route is geographically coherent: consecutive days are hundreds of kilometres apart, not thousands. So the days disambiguate each other. Every candidate for every day votes, weighted by distance, for an anchor; each day then takes its own nearest candidate to that anchor ([`lib/geocode.ts:190`](lib/geocode.ts#L190)):

```ts
let score = 0
for (const other of flat) {
  if (other.i === i) continue
  const nearest = Math.min(...other.cs.map(o => haversineKm(c.lat, c.lon, o.lat, o.lon)))
  if (nearest < CLUSTER_KM) score += 1 - nearest / CLUSTER_KM
}
if (c.nameMatches) score += 0.25
```

That took the same itinerary to **four of four** resolvable places correct, with the fifth flagged as 833 km off-route rather than silently accepted. The right answers had been sitting at position 2 or 5 in the API's own ranking the whole time.

The vote is distance-weighted rather than a yes-or-no radius because the binary version scored a loose sprawl identically to a tight cluster, and on that basis resolved "Shimla" to *Shimlai, Pakistan*.

**What it cost.** Days are no longer independent, which is a real assumption about the input: an itinerary with a genuine discontinuity — a flight from Delhi to Leh — is penalised by a rule that presumes continuity. `CLUSTER_KM = 600` is a constant tuned against one route and checked against one more, not derived. And nothing is applied automatically: every suggestion shows the name, country, and elevation it resolved to and has to be accepted by hand, so the feature is slower to use by design. For an input to a health warning, missing data is the failure I want.

## Running it

Verified end to end on macOS with Node 22.14 and pnpm 10.33 by running every command below in order. Docker must be running; the Supabase CLI does not need a global install, as it is a dev dependency with its own binary.

```bash
pnpm install
pnpm db:start      # local Supabase in Docker; applies all 16 migrations
pnpm seed:local    # 10 categories, 69 items, 122 packed rows, 9 itinerary days
pnpm dev:local     # http://localhost:3000
```

Then, to check the suite and the build:

```bash
pnpm test          # 167 tests, 10 files, no network, ~300ms
pnpm lint          # 0 errors, 16 warnings (see below)
pnpm type-check
pnpm build
```

Three points where the order or the command matters:

- **`pnpm dev:local`, not `pnpm dev`.** They are different scripts. `dev:local` loads `.env.local.supabase`, which points at `http://127.0.0.1:54321`. Plain `dev` reads `.env.local`, which is gitignored and in this working copy points at the deployed Supabase project — so on a fresh clone it fails with `supabaseUrl is required.`, and on a populated one it quietly runs local code against the live database. The same split applies to `pnpm seed` and `pnpm seed:local`.
- **`db:start` before `seed:local`.** Seeding against a stopped stack fails with `TypeError: fetch failed` — `Caused by: Error: connect ECONNREFUSED 127.0.0.1:54321`.
- **`seed:local` before signing up**, if the seeded example trip is wanted. `pnpm db:start` applies migrations but inserts no content, so onboarding's "start from the example" option copies an empty template. It is not an error, just an empty list.

`pnpm db:start` applies the migrations itself — there is no separate migration step locally. `pnpm db:stop` shuts the stack down and `pnpm db:reset` rebuilds it from the migrations.

CI (`.github/workflows/ci.yml`) runs lint, type-check, test, and build on every pull request, then applies pending migrations with `supabase db push --linked` on merge to `main`. Merging is therefore the deploy, and migrations reach production without a dry run.

## What's imperfect

Known defects, first, all found by reading the code against its own stated rules:

- **Three AI routes still derive "today" in UTC.** The rule in this codebase is that anything deciding which day it is goes through `localToday()`, which reads the traveller's timezone from a cookie, because the server runs in UTC and a traveller at UTC+5:30 was being shown the previous day's leg until half past five each morning. The screens honour it (`lib/today.ts:19`, `lib/tobuy.ts:41`, `lib/plan.ts:30`). The AI layer does not: `app/api/ai/briefing/route.ts:52`, `app/api/ai/gaps/route.ts:75`, and `app/api/ai/chat/route.ts:75` all call `new Date().toISOString().slice(0, 10)`. For those hours the Today screen and the assistant disagree about which day it is, and the UTC date is also part of the cache key. `localToday()` reads `cookies()`, which route handlers have, so the fix is small; it is not yet made.
- **Invites can target the wrong trip.** `create_trip_invite()` selects the caller's organised trip with `limit 1` and no ordering, and takes no trip argument (`supabase/migrations/20260904120000_third_partner.sql:43`). Everything else is scoped to the *active* trip, which honours `profiles.current_trip_id` (`lib/trip.ts:57`). For an account organising one trip these are the same row. For an account organising two they need not be, so the settings panel can show one trip's slots while the invite is minted against another — and `revokeInvite()` is trip-scoped, so the result may not be cancellable from the panel that created it.
- **Signing out leaves cached data on the device.** It calls `signOut()` and navigates (`components/settings/settings-screen.tsx:246`); it does not purge the service worker's caches or the outbox. Supabase row reads sit in `DATA_CACHE` and rendered screens in `PAGE_CACHE`, so on a shared device a later user who goes offline can be served the previous user's pages. Cross-account *writes* fail closed at the database, so this is disclosure at rest rather than corruption, but it should be cleared on sign-out and is not.
- **DNS rebinding is not mitigated in the URL importer.** Importing an itinerary from a link means the server fetches an address the caller chooses, so there is a guard: https on port 443 only, every DNS answer checked rather than the first, IPv6 expanded so that embedded IPv4 forms are judged by the IPv4 rules, redirects followed by hand with each hop revalidated, and failure closed. The known hole is timing — `assertSafe()` resolves the hostname at `lib/safe-fetch.ts:161` and `fetch` resolves it again independently at `:192`, with nothing binding the two. A short-TTL hostname can answer publicly on the check and privately on the fetch. Fixing it needs a custom `lookup` or a pinned-address dispatcher.
- **A comment claims protection that is not there.** `app/onboarding/layout.tsx:12` states that `/onboarding` sits behind the auth proxy. It does not: `proxy.ts:14` lists the protected prefixes, `/onboarding` is not among them, and unlisted paths fall through at `proxy.ts:27`. Confirmed by request — signed out, `/app` returns 307 to `/login` and `/onboarding` returns 200. The impact is cosmetic, since every write from that screen then fails, but the stated invariant is not enforced.

Limits and things not measured:

- **No end-to-end or component tests.** The 167 tests are pure logic with no network, which is a deliberate trade — a test that also needs a third-party API to be up fails on a train, for reasons unrelated to the code. It leaves every React component, every server action, the service worker, and the rate limiter uncovered. Those paths were checked by hand.
- **No RLS test in CI.** The isolation table above was produced by hand against a local stack and is not automated, so it verifies one commit rather than every commit. Automating it needs Postgres in CI, which the current workflow does not start.
- **Nothing about performance is measured.** There is no benchmark, no captured Lighthouse run, and no latency figure anywhere in the repository, so this file contains none. What can be said structurally: each screen's reads are one parallel fan-out rather than a sequence, and the trip switcher tallies counts from two grouped queries instead of one per trip. Index coverage is untested and the tables are small — `itinerary` has no index supporting the ordered-by-date lookup the briefing route performs.
- **The rate limiter is per-process and partial.** A token bucket in process memory bounds a runaway client loop, not a distributed caller, and on serverless each instance keeps its own counters. It currently guards four of eleven API routes — the URL importer, geocoding, and the two AI import routes. The replacement goes behind the same `check()` signature.
- **16 ESLint warnings, 0 errors:** 12 `react-hooks/set-state-in-effect`, 3 `@typescript-eslint/no-unused-vars`, 1 React Compiler bailout. Most of the first group are a direct consequence of the AI layer being client-fetched. Left visible rather than silenced.
- **AI is optional, and the key is the user's own.** Keys live in browser storage and travel per request in a header; none is written to the database, so there is nothing at rest to encrypt or rotate. `resolveKey()` (`lib/ai.ts:33`) prefers the caller's own key and falls back to the server key **only** for an administrator — without that, any stranger who registered would spend the operator's credits. The consequence is architectural: a server component cannot see a browser-held key, so every AI surface has to be client-fetched, and none of it can render on the server. With AI disabled the surfaces are absent rather than degraded.
- **Voice was never built.** It was planned, and there is no `/api/voice`, no flag, and no speech dependency. Removed from scope rather than left half-finished.
- **Two partners or three?** The schema says three. A trip holds an organiser plus `partner_1`, `partner_2`, and `partner_3` — verified against the built database, where `trip_members_member_key_check` admits exactly those four values. The two-partner wording survives only in the prose of superseded migrations (`supabase/migrations/20260828140000_multi_tenancy.sql:38`, `supabase/migrations/20260828200000_trip_invites.sql:14`), both widened by `supabase/migrations/20260904120000_third_partner.sql`. Migration files are append-only history, so that text stays wrong where it stands.

## Stack

- Next.js 16, App Router, React 19, Turbopack
- TypeScript, Tailwind CSS
- Supabase — Postgres, Auth, Realtime
- Vitest
- OpenAI via `@ai-sdk/openai`, optional, default model `gpt-5.6-luna`
- Open-Meteo for forecasts and geocoding, keyless
- Hand-written service worker, no PWA framework
- 24 runtime dependencies
- Deployed on Vercel

`CLAUDE.md` carries the working architecture notes: the invariants, the traps, and why each one is there.

## Licence

MIT. See [LICENSE](LICENSE).
