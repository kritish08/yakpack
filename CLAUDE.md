# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## What This Repo Is

**YakPack** — an offline-first Spiti trip companion PWA, live at `yakpack.tech` on
Vercel and open source under MIT. This is the **built application**, not a spec:
Next.js 16 (App Router, React 19) on Supabase (Postgres + Auth + Realtime), with an
optional OpenAI layer users bring their own key for.

It is **multi-tenant**: registration is open, and each account gets its own trip
copied from a template. A trip holds one or two people.

`/docs` holds the original build spec (`01`–`08`) plus two audit reports (`09`, `10`).
Treat those as **historical**: they describe intent and past findings, and several
items in them are now fixed or deliberately superseded. The code is the source of truth.

Milestones **M0–M8 are complete**. **M9 (voice) was never built** — there is no
`/api/voice`, no `VOICE_ENABLED` flag, and no Azure Speech dependency. Don't
reintroduce them without being asked.

---

## Commands

```bash
pnpm dev             # dev server with Turbopack
pnpm build           # production build
pnpm lint            # eslint (flat config; `next lint` was removed in Next 16)
pnpm type-check      # tsc --noEmit
pnpm seed            # parse /docs/01 + /docs/02 → Supabase (needs SUPABASE_SERVICE_ROLE_KEY)
pnpm tsx lib/restore.ts --dry-run   # additive restore of missing master items
supabase db push     # apply migrations
```

CI (`.github/workflows/ci.yml`) runs lint → type-check → build on every PR, then
`supabase db push --linked` on merge to `main`. **Migrations auto-apply on merge** —
review them like production changes.

ESLint is pinned to `^9`: `eslint-plugin-react` 7.37.x (via `eslint-config-next`)
still calls `context.getFilename()`, which ESLint 10 removed.

---

## Architecture

```
[ Two phones ] ──HTTPS──> [ Next.js 16 @ yakpack.tech ]
                              ├─ proxy.ts            — auth gate on every route
                              ├─ Server Components   — data fetching via lib/*.ts
                              ├─ app/actions/*       — all writes ('use server')
                              └─ app/api/*           — weather proxy, AI routes
                                       │
                          ┌────────────┴────────────┐
                    [ Supabase ]              [ Open-Meteo ]      [ OpenAI ]
                 Postgres/Auth/Realtime      (server-side)     (server-side only)
```

- **Auth**: `proxy.ts` (Next 16's rename of `middleware.ts` — do not recreate
  `middleware.ts`) gates everything except `/login`, `/reset-password`, `/api/auth`.
- **Reads**: one `getXData()` per screen in `lib/` (`today`, `pack`, `tobuy`, `plan`),
  each parallel-fetching under RLS with the cookie-bound client.
- **Writes**: server actions in `app/actions/`, each re-checking `getUser()` and
  sanitising free text via `lib/sanitize.ts` before it can reach an AI prompt.
- **Weather**: server components call Open-Meteo **directly** (`lib/today.ts`) rather
  than self-fetching `/api/weather` — building an internal URL from the Host header
  is an SSRF vector. `/api/weather` exists for client-side fetches and requires a session.
- **Realtime**: Pack patches `packed` rows from the payload; Summary re-fetches via a
  debounced `router.refresh()`. Tables must be in the `supabase_realtime` publication
  or subscriptions silently never fire — see the publication migration.

### Project structure

```
app/
  (marketing)/            # PUBLIC: / landing, /terms, /privacy
  (auth)/login, register, reset-password
  app/                    # the product, all auth-gated: /app, pack,
                          # to-buy (Summary), plan, ask, settings
  actions/                # items, tobuy, categories, trip — all writes
  api/weather, api/ai/{chat,parse-item,plan-insight}, api/auth/callback
components/  landing/, {today,pack,tobuy,plan,ask,pemba,settings,ui}/
lib/         supabase/, trip, today, pack, tobuy, plan, progress, weather,
             ams, ai, byok, briefing, sanitize, offline-queue, seed, restore
supabase/migrations/
styles/tokens.css   proxy.ts   public/sw.js   public/landing/
```

**Routing**: `/` is a public landing page; the product lives under `/app/*`.
`proxy.ts` skips the Supabase session lookup entirely for `/`, `/terms` and
`/privacy` — a marketing pageview should not cost an auth round-trip.

---

## Offline / PWA — read before touching `public/sw.js`

**Never cache RSC navigation payloads.** Next's client-side navigation is a plain
`fetch` carrying an `RSC: 1` header and a `?_rsc=<hash>` param — `request.mode` is
**not** `'navigate'`, so it will fall into any catch-all branch you add. Two reasons
this must stay network-only:

1. `_rsc` is a deterministic hash of the router state, not a nonce. A cached entry is
   replayed forever, so screens go permanently stale **even online**, silently
   defeating `revalidatePath()`.
2. When an RSC fetch fails, Next reverts to a full-page (MPA) navigation, which the
   document-navigation handler serves from `PAGE_CACHE`. Letting it fail is precisely
   what makes offline navigation work.

This exact bug shipped once and broke offline *and* online freshness. The guard is
`isRscRequest()` at the top of the fetch handler.

Other rules: static assets are cache-first; Supabase `GET /rest/v1/*` and `/api/weather`
are network-first with a cache fallback; Supabase auth/realtime and every other
`/api/*` are network-only. Bump `CACHE_VERSION` whenever caching behaviour changes —
`activate` purges every cache not in `KEEP`.

**Offline writes**: `lib/offline-queue.ts` is a localStorage outbox for `packed`
toggles. `<OfflineSync>` (mounted in the authenticated layout, so it runs on any tab)
replays it on mount and on `online`, then refreshes. Pack projects the pending queue
over its server-rendered rows with `applyOps()` — without that, an offline reload
serves cached HTML carrying the pre-toggle snapshot and the user's check-offs look
lost. Server actions are POSTs and are **not** queued; they simply fail offline.

---

## Key Design Constraints

**Tokens only — no hardcoded hex.** All colours come from `styles/tokens.css`
variables. Dark-first; light via `next-themes` (`data-theme`). Full tables in
`docs/05_branding_design.md`.

**Two users, closed system.** Supabase public signup is disabled; two accounts are
pre-created. `profiles.role` is `'kritish' | 'partner'` and is **immutable after
creation** (enforced by a trigger).

**Optimistic + instant.** No toggle spinners; realtime reconciles in the background.

**Mobile-first, ≥ 44 px targets, safe-area insets.** Bottom tabs: Today · Pack ·
Summary · Plan · Ask (Ask is absent entirely when AI is off — never degraded).

---

## Data Model

| Table | Purpose |
|---|---|
| `trips` | One row per trip. `is_template` marks the row new signups are copied from |
| `trip_members` | `(trip_id, user_id, member_key)`; `member_key` is `'owner'` or `'partner'`, unique per trip |
| `trip_contacts` | `trip_id` scoped; free-text `role` + name/phone/note. Any number per trip |
| `profiles` | Display name and colour only — **there is no global role column** |
| `categories` | `trip_id` scoped; `sort_order` drives display order |
| `items` | `trip_id` scoped · `status` · `assigned_to` (`owner`/`partner`/`shared`) · `scope` |
| `packed (item_id, user_key)` | `scope='each'` → one row per member; `'shared'` → a single row |
| `itinerary` | `trip_id` scoped; primary key is `(trip_id, day)`, not `day` |

**Two orthogonal roles — do not conflate them.**

| | Column | Values | Meaning |
|---|---|---|---|
| Trip slot | `trip_members.member_key` | `organiser` / `partner_1` / `partner_2` | Who you are *within one trip* |
| App standing | `profiles.app_role` | `admin` / `user` | Who you are *in the deployment* |

Vocabulary, because these collide easily:

- **admin** — operates the deployment. Manages the server API key and accounts.
- **organiser** — signed up and created a trip. Invites partners into it.
- **partner** — invited into someone else's trip. Up to two per trip.

The word **owner** is deliberately unused: it reads as owner-of-the-application,
which is `app_role`, an unrelated axis. A person is simultaneously the `organiser`
of their own trip and (usually) just a `user`. Never collapse these into one
column — that was the original design and it is what made opening registration
unsafe.

`app_role` is guarded by the `profiles_prevent_app_role_change` trigger: a signed-in
user updating their own profile **cannot** grant themselves admin. Only the service
role (and migration roles) may change it. The earliest account is promoted to admin
on migration, so a fresh self-hosted install has one without manual SQL.

**RLS** resolves through `public.is_trip_member(trip_id)` (SECURITY DEFINER so policies
on `trip_members` do not recurse). `packed` has no `trip_id` — it inherits scope from
its item, and writes are additionally pinned to the caller's own `member_key` or
`'shared'`. `itinerary` is read-only to clients.

This is verified, not assumed: an authenticated user holding another trip's real UUID
cannot read its rows, insert into it, or add themselves to it as a member.

**Partner invites.** `create_trip_invite()` allocates the first free slot
(`partner_1` then `partner_2`), where "free" means held by neither a member nor a
live invite — that is what caps a trip at two partners. It returns a 256-bit token;
there is no mail provider wired in, so the organiser shares the link themselves.

`accept_trip_invite()` is SECURITY DEFINER because the invitee is by definition not
yet a member and cannot read the invite under RLS, so every check the policies would
have made is made explicitly. It checks membership *before* status, so someone
re-opening their own accepted link gets a quiet no-op rather than "no longer valid" —
while a different user with the same token is still refused.

Removing a partner deletes their `packed` rows: `user_key` holds a slot, not a user
id, so leaving them would silently hand their progress to whoever fills that slot next.

**Trip contacts** are rows, not columns. `trips` used to carry
`coordinator_name/phone` and `leader_name/phone` — the org chart of the one tour
package this app was built around. A self-drive trip has neither; a trek has a
guide and a permit office. So `trip_contacts` holds any number per trip, each with
a free-text `role`. Read for members, write for the organiser, same as `itinerary`.

The rule for copying: **the packing list copies from the template in both creation
paths; route data — itinerary and contacts — copies only in the signup bootstrap.**
A trip you create yourself starts with your own days and your own numbers.

**Registration** calls `create_trip_from_template()`, which copies the template trip's
categories, items, packed rows and itinerary atomically. It is idempotent — a retried
signup returns the existing trip. `app/app/layout.tsx` calls `ensureTripContext()` as a
safety net, because email confirmation can separate signup from the first session.

⚠️ The token default uses `gen_random_uuid()`, not `gen_random_bytes()` — the latter
needs pgcrypto, which a self-hosted clone may not have enabled.

⚠️ **Never copy categories by joining on `sort_order`** — it is not unique within a
trip, and the join fans out into a cartesian product that silently duplicates items.
The bootstrap function loops row by row for this reason.

---

## Today Screen Logic

```ts
// Weather rules → carry_tags → real packing items (lib/weather.ts):
//   temp_min < 5 || altitude > 4000     → 'cold'
//   precipitation_probability_max >= 50 → 'rain'
//   uv_index_max >= 6                   → 'uv'
```

`lib/today.ts` counts an item packed only from the **current user's** perspective
(their own rows plus `'shared'`) — do not revert that to a global `packedIds` set.
`lib/ams.ts` derives altitude-gain risk with no AI dependency and is client-safe.

---

## AI Layer (optional)

Provider is **direct OpenAI** via `@ai-sdk/openai`. `lib/ai.ts` exposes `getModel()`
and `modelFromRequest()`.

**BYOK**: users bring their own OpenAI key. It lives in browser storage
(`lib/byok.ts` — sessionStorage by default, localStorage when they tick "remember")
and rides along as an `x-openai-key` header per request. It is **never written to the
database**, so there is no key at rest to encrypt, rotate, or lose.

`resolveKey(req, callerIsAdmin)` in `lib/ai.ts` is the single place this is decided:
a request's own key wins; otherwise the server `OPENAI_API_KEY` is used **only for an
admin**. That guard is the point — without it any stranger who registered would be
spending the operator's credits. No key on either path returns `402`.

Because of that, **every AI surface is client-fetched** through a route handler
(`/api/ai/{chat,briefing,gaps,plan-insight,parse-item}`). A server component can never
see a browser-held key, so do not move AI generation back into one.

Surfaces: `/api/ai/chat` (streaming + tools), `/api/ai/parse-item`, `/api/ai/plan-insight`,
plus `AiBriefingCard` and `AiGapsCard`, which generate inline in server components
behind `unstable_cache` rather than through a route handler.

Chat tools: `getCurrentLeg`, `getItinerary`, `getWeather`, `getCategories`,
`getPackingState` auto-execute (read-only). The write tools — `addItems`, `updateItem`,
`deleteItem`, `markAsBought` — have **no `execute`**; a client confirmation sheet is the
only path to a mutation. Keep it that way.

`PEMBA_SYSTEM` carries a medical guardrail: never prescribe doses, always defer to a
doctor on AMS/Diamox. Don't weaken it.

**In async server components, keep JSX out of the `try`.** Do the awaiting inside, then
return the markup after — otherwise a render error is swallowed by a catch meant for the
fetch, and `react-hooks/error-boundaries` will (correctly) fail the build.

---

## Feature Flags

```bash
AI_ENABLED=true    # absent/false → every AI surface disappears; rule-based app stays green
```

AI UI must be **completely absent** when off — not degraded.

---

## Env Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only. Seed/restore scripts AND the admin
                                # panel at runtime — it must be set in production.
NEXT_PUBLIC_SITE_URL=https://yakpack.tech

AI_ENABLED=true
OPENAI_API_KEY=                 # optional server fallback; users can bring their own
OPENAI_MODEL=gpt-5.6-luna       # override to swap models without a deploy
# OPENAI_USE_RESPONSES=false    # fall back to chat completions
# OPENAI_BASE_URL=              # only for an OpenAI-compatible gateway

# Optional seed overrides. Name and departure otherwise come from the Trip Meta
# table in docs/01. Contacts are rows in `trip_contacts`, not env vars.
TRIP_NAME=
TRIP_DEPART_DATE=
```

## Before making the repo public

Two third-party phone numbers were committed in `47df9ad` and `51124ca`. The working
tree is clean, but **the history is not** — scrub those two commits (filter-repo or a
squashed initial commit) before flipping visibility.

---

## Typography

- `Syne` 700–800 — display/headings, uppercase, tracking `-0.03em`
- `DM Sans` 300–500 — body/UI
- `DM Mono` 400–500 — labels, meta, weather numbers

## Colour Tokens (quick ref)

Dark: `--bg #0f0e0c` · `--surface #171614` · `--accent #d4943a` (amber) ·
`--accent-2 #4a9e7e` (packed) · `--accent-3 #9e4a4a` (warning) · `--accent-4 #4a6e9e` (info/cold).
Per-person chips: Kritish → amber · partner → blue · shared → green.

---

## Deployment

**Vercel (primary).** Push to `main` → CI → deploy. Env vars live in the Vercel
dashboard; the app 500s without the Supabase pair.

**Self-host**: `BUILD_STANDALONE=true pnpm build`, then `yakpack.tech { reverse_proxy app:3000 }`.
