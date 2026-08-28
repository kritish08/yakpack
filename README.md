<div align="center">

# YakPack

**An offline-first packing and itinerary companion for the Spiti Valley.**

Weather-aware packing · a nine-day plan · an AI guide you bring your own key for

[yakpack.tech](https://yakpack.tech) · [Terms](https://yakpack.tech/terms) · [Privacy](https://yakpack.tech/privacy)

</div>

---

## What this is

YakPack was written for one specific trip: nine days from Delhi into the Spiti
Valley and back, climbing from 216 m to 4,590 m at Kunzum La, with two days where
there is no phone signal at all.

Packing for that with another person is genuinely awkward. You carry a down jacket
you will not touch for four days and a headlamp you need at exactly one campsite.
Half the kit is shared and should only be carried once. And the day the packing
matters most is the day you cannot reach the internet.

So the trip became the spec. Everything here exists because something on that road
needed it.

## Features

- **Weather-aware packing.** Items carry tags. Below 5 °C or above 4,000 m the cold
  layers surface on their own; over 50 % rain pulls the cover out; UV above 6 pulls
  the sunscreen.
- **Up to three people, one list.** The organiser invites up to two partners by
  link. Items belong to one person or to everyone; personal items track a packed
  state each, shared items track one. Changes sync in under a second.
- **Genuinely offline.** The pack list, plan and last-known forecast stay readable
  with the radio off. Check-offs made offline queue on the device and replay on
  reconnect.
- **Pemba, the AI guide.** Reads your real itinerary, live weather and packing state
  before answering. It can add items — every write stops at a confirmation sheet.
- **Bring your own key.** Pemba runs on your OpenAI key, held in your browser and
  passed per request. It is never written to the database. The deployment's own key
  is reserved for the admin account, so no one else can spend it.
- **A small admin panel.** The operator can list accounts, rename them, reset a
  password, grant or revoke admin, and delete an account with everything it owns.

## Stack

Next.js 16 (App Router, React 19) · Supabase (Postgres, Auth, Realtime) ·
Tailwind v4 · Vercel AI SDK with OpenAI · Open-Meteo · a hand-written service worker

## Running it yourself

```bash
pnpm install
cp .env.example .env.local     # fill in your Supabase project
supabase db push               # apply migrations
pnpm seed                      # build the template trip from /docs
pnpm dev
```

Registration copies the **template trip** into each new account, so run `pnpm seed`
once before anyone signs up or new accounts land in an empty app.

| Command | Does |
|---|---|
| `pnpm dev` | Dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm seed` | Parse `/docs` into the template trip (needs the service-role key) |
| `pnpm tsx lib/restore.ts --dry-run` | Re-add master items missing from a trip |

## Environment

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only; seed scripts and the admin panel
NEXT_PUBLIC_SITE_URL=https://yakpack.tech

AI_ENABLED=true                 # absent/false hides every AI surface
OPENAI_API_KEY=                 # optional fallback; users can bring their own
OPENAI_MODEL=gpt-5.6-luna
```

With `AI_ENABLED=false` the AI UI is **absent**, not degraded — the rule-based
weather, packing and altitude logic works on its own.

## Roles

Two independent axes.

`trip_members.member_key` (`organiser` / `partner_1` / `partner_2`) is your slot
inside a trip. `profiles.app_role` (`admin` / `user`) is your standing in the
deployment. Everyone who registers is the `organiser` of their own trip and a plain
`user`; an organiser can invite up to two partners into it.

The first account created becomes the admin. A database trigger prevents anyone from
granting themselves that — only the service role can change `app_role`.

## How the data is scoped

Every content table carries a `trip_id`, and every RLS policy resolves through
`trip_members`. A user owns their own trip and can additionally be the partner on
someone else's. Identity is per-trip (`owner` / `partner`), never global.

The isolation is enforced in Postgres, not in application code: an authenticated
user holding another trip's UUID still cannot read its items, write to it, or add
themselves to it.

## A note on the service worker

Next's client-side navigation is a plain `fetch` carrying `RSC: 1` and a `?_rsc=`
parameter — it is **not** a document navigation, so it falls into any catch-all a
service worker adds. Caching it breaks the app in both directions: screens go
permanently stale online, and offline navigation dies. `public/sw.js` deliberately
lets those requests through to the network; when one fails, Next falls back to a
full page navigation, which the worker *does* serve from cache. That is what makes
offline navigation work.

## Contributing

Issues and pull requests are welcome. `pnpm lint && pnpm type-check && pnpm build`
should pass before opening one.

## Licence

MIT — see [LICENSE](./LICENSE).
