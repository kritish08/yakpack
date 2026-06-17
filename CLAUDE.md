# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A **docs-only build package** for **YakPack** — a two-person Spiti trip companion app (departure June 19). There is no code here; these 8 files are the complete spec. To build:

1. Create a new git repo, place these files in `/docs`.
2. Paste `06_claude_code_prompt.md` into Claude Code to kick off the build.
3. Build milestone by milestone (M0 → M7 core, then M8–M9 optionally).

Deploy the skeleton to `yakpack.tech` at M0 — iterate live from there.

---

## App Dev Commands (once scaffolded)

```bash
pnpm dev             # dev server with Turbopack
pnpm build           # production build
pnpm lint            # ESLint
pnpm type-check      # tsc --noEmit
pnpm seed            # parse /docs/01 + /docs/02 → Supabase (requires SUPABASE_SERVICE_ROLE_KEY)
supabase db push     # apply migrations
```

---

## Build Order (Milestones)

| M# | Goal | Done when |
|---|---|---|
| M0 | Scaffold + theming | Next.js 16, Tailwind tokens wired, dark/light no-flash, running on subdomain |
| M1 | Schema + seed | All tables + RLS seeded from `01` + `02`; item/itinerary counts match |
| M2 | Auth gate | 2 pre-created accounts, middleware-protected routes, `/login` only public |
| M3 | Pack + realtime | Collapsible categories, optimistic check-off, live sync <1s on two devices |
| M4 | Today + weather | Open-Meteo hero, weather-reactive carry chips, heads-up, warnings |
| M5 | To-Buy + progress | `to_buy` filter, overall/person/category progress bars |
| M6 | Plan + Pemba | 9-day timeline, mascot moods, full design + motion pass |
| M7 | PWA + deploy | next-pwa, Lighthouse ≥ 90, `yakpack.tech` live, two-phone verified |
| M8 | AI layer | Azure OpenAI: `/api/ai/briefing`, `/chat`, `/gaps`; gated by `AI_ENABLED` |
| M9 | Voice + import | MAI-Voice TTS, MAI-Transcribe STT; `/api/itinerary/import`; gated by `VOICE_ENABLED` |

The rule-based fallback must stay green throughout. M8 and M9 are enhancements, never dependencies.

---

## Architecture

```
[ Browser — two phones ]
        │ HTTPS
        ▼
[ Next.js 16 App Router @ yakpack.tech ]
    ├─ Server Components: initial auth render, data fetching
    ├─ Route Handlers:
    │     /api/weather        — Open-Meteo proxy, 30–60 min cache
    │     /api/ai/*           — Azure OpenAI (server-only key)
    │     /api/voice/*        — Azure Speech (server-only key)
    └─ Client Components: Supabase Realtime subscriptions, optimistic UI
              │
              ▼
[ Supabase: Postgres + Auth + Realtime ]    [ Open-Meteo (no key needed) ]
```

- List reads/writes: client → Supabase under RLS; realtime channel syncs the other device.
- Weather is proxied through `/api/weather` so both users share one cached call.
- All AI and voice keys are server-side only — never in client bundles.

### Project structure

```
yakpack/
  docs/                    ← these spec files
  app/
    (auth)/login/page.tsx
    (app)/page.tsx          # Today
    (app)/pack/page.tsx
    (app)/to-buy/page.tsx
    (app)/plan/page.tsx
    api/weather/route.ts    # Open-Meteo proxy
    api/ai/                 # briefing, chat, gaps, parse-item (M8)
    api/voice/              # tts, stt (M9)
    layout.tsx
  components/               # TodayHero, CarryChips, ItemRow, CategoryCard, Pemba, ProgressBar…
  lib/supabase/ , lib/weather.ts , lib/ai.ts , lib/seed.ts
  supabase/migrations/
  styles/tokens.css
  middleware.ts
```

---

## Key Design Constraints

**Tokens only — no hardcoded hex.** All colors from `styles/tokens.css` CSS variables. Dark-mode first; light mode via `next-themes`. Full token tables in `05_branding_design.md`.

**Two users, closed system.** Supabase public signup is disabled. Two accounts pre-created (Kritish + partner). Middleware protects every route except `/login`. Role mapped via `profiles.role` (`'kritish'` | `'partner'`).

**Optimistic + instant.** No toggle spinners; Supabase realtime reconciles quietly in background. Skeletons while weather loads; cached last-known weather + "stale" tag when offline.

**Mobile-first, ≥ 44 px targets.** Bottom tab bar: Today · Pack · To-Buy · Plan · Ask.

---

## Data Model

Full DDL in `04_tech_plan.md §3`. Key tables:

| Table | Purpose |
|---|---|
| `categories` | Packing categories from `01`'s `##` blocks; `sort_order` from leading number |
| `items` | `status` (owned/to_buy/standard) · `assigned_to` (kritish/partner/shared) · `scope` (each/shared) · `carry_tags[]` |
| `packed (item_id, user_key)` | Per-person packed state. `scope='each'` → two rows; `scope='shared'` → one `'shared'` row |
| `itinerary` | One row per leg; `lat`/`lon` for Open-Meteo; `carry_today[]`, `warnings`, `network`, `fun`, `tip` |
| `trip` | Single row (id=1): name, `depart_date`, coordinator + leader phones (render as `tel:`) |

RLS: all tables gated to `auth.role() = 'authenticated'`.

---

## Today Screen Logic

```ts
const todayLeg = itinerary.find(d => isSameDay(d.date, new Date())) ?? manualOverrideLeg;
const wx = await fetch(`/api/weather?lat=${todayLeg.lat}&lon=${todayLeg.lon}`).then(r => r.json());
// Weather rules → carry_tags → real packing items:
//   temp_min < 5 || altitude > 4000   → 'cold'  (down jacket, thermals, gloves)
//   precipitation_probability_max ≥ 50 → 'rain'  (rain cover, raincoat)
//   uv_index_max ≥ 6                  → 'uv'    (sunscreen, sunglasses, lip SPF)
```

Open-Meteo params: `current=temperature_2m,weather_code,apparent_temperature,wind_speed_10m` + `daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max`.

---

## Seed Parsing (`01_packing_list_master.md`)

- `##` block → category; strip leading number for display name, use it as `sort_order`.
- Bullet → item; parse `status` from the inline backtick tag; `assigned_to` from trailing `each`/`shared`; `scope` = same as `assigned_to` default.
- `scope='each'` → create one item but two `packed` rows (one per user).
- Trip Meta table → `trip` row (id=1). Contacts → `coordinator_*` / `leader_*` columns.

---

## Feature Flags

```bash
AI_ENABLED=true       # set false/absent → hides all AI UI; rule-based Today stays green
VOICE_ENABLED=true    # set false/absent → hides voice controls; browser Web Speech fallback
```

AI/voice UI must be completely absent when flags are off — not degraded.

---

## Color Tokens (quick ref)

Dark: `--bg #0f0e0c` · `--surface #171614` · `--accent #d4943a` (amber, primary) · `--accent-2 #4a9e7e` (packed/green) · `--accent-3 #9e4a4a` (warning/red) · `--accent-4 #4a6e9e` (info/cold/blue)

Per-person chips: Kritish → amber · Partner → blue · Shared → green.

Full light + dark token tables: `05_branding_design.md`.

## Typography

- `Syne` 700–800 — display/headings, uppercase, tracking `-0.03em`
- `DM Sans` 300–500 — body/UI
- `DM Mono` 400–500 — labels, meta, weather numbers (big temp: `clamp(40px, 9vw, 72px)`)

---

## AI Layer (M8 — `07_ai_integration.md`)

Routes: `/api/ai/briefing` (GET, cached per leg+date) · `/api/ai/chat` (POST, streaming + tool calling) · `/api/ai/gaps` (GET, structured risk list) · `/api/ai/parse-item` (POST, NL → items).

Stack: Vercel AI SDK (`ai` + `@ai-sdk/azure`). Model swappable via `AZURE_OPENAI_DEPLOYMENT` env with no code changes.

Tools available to the model: `getCurrentLeg`, `getWeather(legDay)`, `getItinerary`, `getPackingState(filter)` (read-only) + `addItems(items[])` (write, always gated behind a confirm sheet).

`PEMBA_SYSTEM` must include medical caution: never prescribe doses, always defer to a doctor for AMS/Diamox questions.

---

## Voice Layer (M9 — `08_voice_ai.md`)

Routes: `/api/voice/tts` (POST text → audio stream) · `/api/voice/sst` (POST audio blob → text).
Models: `MAI-Voice-1/2` (TTS) · `MAI-Transcribe-1/1.5` (STT, 43 languages incl. Hindi).
Cache briefing audio per leg+date. Raw mic audio is transcribed and discarded — never persisted.
Fallback: browser `speechSynthesis` / `SpeechRecognition` when `VOICE_ENABLED=false`.

---

## Env Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=         # server-only; seed script only

# AI layer (optional — M8)
AI_ENABLED=true
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-5.5
AZURE_OPENAI_API_VERSION=2024-10-21

# Voice layer (optional — M9)
VOICE_ENABLED=true
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
AZURE_TTS_VOICE=MAI-Voice-1
AZURE_STT_MODEL=MAI-Transcribe-1.5
```

---

## Deployment

**Vercel (primary):** push to GitHub → import → set env vars → Domains → add `yakpack.tech` → CNAME `yakpack` → `cname.vercel-dns.com`.

**Self-host (Docker + Caddy):**
```caddy
yakpack.tech { reverse_proxy app:3000 }
```
A record: `yakpack` → server IP. Use Next.js standalone output.
