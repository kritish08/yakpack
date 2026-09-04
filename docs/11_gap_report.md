# Gap report — what is left before YakPack is publishable

> **Status, 2026-09-04:** P0 (items 1–2), P1 (items 3–4) and P2 (items 5–7) are
> **done** — see the commits following this report. What remains is P3 (polish and
> doc drift) and P4 (tests, history scrub, deploy).

Written 2026-09-04, after the multi-tenancy, BYOK, contacts and onboarding work.

Deliberately scoped to **finishing what exists**. Nothing here proposes a new
feature; every item is either a promise the app already makes and does not keep,
or a thing a published SaaS cannot reasonably ship without. Items are ordered by
what they cost the product, not by effort.

---

## P0 — The app contradicts its own promise

### 1. A new account never sees the onboarding flow

`app/(auth)/register/page.tsx` calls `bootstrapTrip()`, which runs
`create_trip_from_template()` and copies the seeded trip: **9 Spiti days, 69
Spiti items, and the template's contacts**. The user is then pushed to `/app`.

The three-way onboarding built at `/app/trips/new` is reachable **only from the
trip switcher** — that is, from the second trip onwards. So the "initial step on
onboarding" is not wired to onboarding, and every new account of a product
marketed as a generic travel companion opens on somebody else's Himalayan road
trip, complete with Diamox and an oxygen can.

This is the single most visible gap. It undoes both the generic positioning and
the onboarding work.

**Fix:** registration creates the account and sends the user to
`/app/trips/new`. The template copy stops being the default and becomes one of
the choices — "start from an example trip" — which is also the honest way to
keep the Spiti data as a demo rather than as everyone's default.

### 2. There are no error boundaries

No `error.tsx`, no `not-found.tsx`, no `global-error.tsx` anywhere in `app/`.
Every 500 produced during this session — and there were several — renders as
Next's bare "Application error: a client-side exception has occurred" in
production. There is also no 404 for a mistyped URL.

**Fix:** a route-level `error.tsx` under `app/app/`, a `not-found.tsx`, and a
`global-error.tsx` for the root. Small, and the difference between "broken" and
"something went wrong, here is the way back".

---

## P1 — The PWA does not fully keep the offline promise

The premise of this app is a valley with no signal. That is the part a reader of
the write-up will test hardest.

### 3. Summary / To-Buy check-offs are lost offline

`lib/offline-queue.ts` is an outbox for `packed` toggles, and only
`components/pack/pack-screen.tsx` uses it. `to-buy-screen.tsx` calls server
actions and refreshes — and server actions are POSTs, which simply fail with no
connection.

Ticking things off in a shop with one bar of signal is precisely the scenario the
app exists for, so this is the wrong half to have left out. `CLAUDE.md` records
it as a known limitation, which is honest, but the UI does not say so.

**Fix, in order of preference:** extend the outbox to `status` changes on
`items` (same shape as the `packed` ops), or — if that is too much for now — show
the offline state on the To-Buy screen so a tap that will not persist is not
presented as one that will.

### 4. The new screens have no offline story

`/app/trips/new`, `/api/geocode` and `/api/import/url` all need the network and
all fail with a generic "Could not reach the server". None of them checks
`navigator.onLine` or says the obvious thing.

**Fix:** an offline notice on the flow, and let the manual path work offline as
far as the final save, since typing days needs nothing.

---

## P2 — SaaS robustness

### 5. No rate limiting anywhere

None of these have any limit:

- `/api/import/url` — makes a **server-side fetch to a user-supplied URL**. The
  SSRF guard stops it reaching private addresses, but nothing stops one account
  using it as a general-purpose fetch proxy at whatever rate they like.
- `/api/geocode` — hits Open-Meteo, a free service, on someone else's goodwill.
- `/api/ai/*` — bounded by the caller's own key today, which is the only reason
  this is not already a problem. It becomes one the moment a server key is
  introduced for paying tenants.

**Fix:** a per-user token bucket. This is the one item that is genuinely
load-bearing for a public deployment rather than a portfolio.

### 6. A tenant cannot delete their own account or export their data

`app/actions/admin.ts` lets an **admin** delete users. There is no self-serve
path, and no export. For anything published as a SaaS — and for the privacy page
already shipped — this is table stakes.

**Fix:** "Delete my account" in Settings (cascade already exists via
`trips.created_by` and membership), and a JSON export of the caller's trips.

### 7. `SUPABASE_SERVICE_ROLE_KEY` is required at runtime

Needed by the admin panel in production. Every action in `app/actions/admin.ts`
does start with `requireAdmin()` — verified — so the guard is right. It is still
worth stating in the README that this key's presence is what makes the
deployment's blast radius what it is.

---

## P3 — Consistency and polish

8. `components/tobuy/to-buy-screen.tsx:350` still falls back to the literal
   string `'Spiti Valley'` when a trip has no name.
9. Documentation drift, all visible in a public repo:
   - `CLAUDE.md` still frames the project as milestones M0–M8 with M9 unbuilt.
   - `docs/04_tech_plan.md` still documents `coordinator_name` / `leader_phone`
     columns that no longer exist.
   - `app/(marketing)/page.tsx` says PDF and link import need an OpenAI key. As
     of the keyless import work, they do not.
10. No `loading.tsx` for `/app/ask` or `/app/trips/new`; the other five screens
    have one.

---

## P4 — Before it goes public

### 11. There is no test suite

`package.json` has no `test` script, and CI runs lint → type-check → build only.
Every correctness claim in this project — the SSRF address rules, the RLS
isolation cases, the route-aware geocoding, the packing rules, the itinerary
parser — was proven with throwaway scripts that were then deleted.

That is the largest gap for a repo whose point is to be read. The most
interesting code in it currently has nothing a reader can run, and nothing stops
a future edit silently undoing any of it. The hard part — knowing what to assert
— is already done; it is transcription.

**Fix:** Vitest, and port what has already been written: the 39 SSRF address
cases, the geocode route resolution (pure, no network), the itinerary parser, the
packing rules, and the text normaliser. Add `pnpm test` to CI.

### 12. Git history still contains two third-party phone numbers

Commits `47df9ad` and `51124ca`. The working tree is clean; the history is not.
Must be scrubbed before the repository is made public.

### 13. Production is on the old schema

The branch is nine commits ahead and unpushed. Seven migrations are unapplied,
including the multi-tenancy change that drops `profiles.role`. Schema and
application **must land together** — CI applies migrations on merge to `main`,
so the merge is the deploy.

---

## Sequencing

| Order | Work | Why now |
|---|---|---|
| 1 | P0 (1, 2) | Wrong first impression; a reader hits this in the first minute |
| 2 | P3 (8, 9, 10) | Cheap, and 9 is embarrassing in a public repo |
| 3 | P1 (3, 4) | The offline claim is the thing people will actually test |
| 4 | P4 (11) | Makes everything above verifiable rather than asserted |
| 5 | P2 (5, 6) | Needed for a real deployment, not for the write-up |
| 6 | P4 (12, 13) | The last two actions before publishing |

Rough shape: 1–3 is about a day and gets the product coherent. 4 is another day
and is what makes it worth reading. 5 is a day and is what makes it safe to leave
running. 6 is an afternoon.

**Nothing in this list is a new feature.** The closest is per-user rate limiting,
and that exists only because one of the routes fetches arbitrary URLs on the
server's behalf.
