# YakPack — Tech Implementation Plan

> **Superseded in places — read as history, not as the schema.** This documents the
> original single-trip, two-person design. Since then the app became multi-tenant and
> the data model moved: `trip` became `trips` with per-trip scoping, `profiles.role`
> was dropped for `trip_members.member_key` and `profiles.app_role`, and the
> `coordinator_*` / `leader_*` columns below became rows in `trip_contacts`. The
> migrations in `supabase/migrations/` are the schema; `CLAUDE.md` is the current map.


## 1. Stack (and why)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router) + TypeScript** | Latest; SSR + route handlers, easy subdomain hosting |
| Styling | **Tailwind CSS** + CSS-variable tokens | Themeable; maps 1:1 to `05_branding_design.md` |
| UI | **shadcn/ui** + **Lucide** | Accessible primitives, easy to brand |
| Theming | **next-themes** | System default + toggle, no SSR flash |
| Backend / DB | **Supabase** (Postgres + Auth + Realtime) | Auth + DB + live sync in one — ideal for 2 users |
| Weather | **Open-Meteo** (free, no API key) | Current + daily by lat/long: temp, hi/lo, sunrise/sunset, UV, wind, precip, weather code |
| Data fetching | Supabase client + realtime channels; TanStack Query for weather caching | Live list + cached forecasts |
| PWA / offline | `next-pwa` / Serwist | Installable + offline cache for dead zones |
| Hosting | **Vercel** (primary) or Docker self-host | Subdomain + HTTPS fast; self-host option below |

> **Next.js 16 notes:** App Router + React Server Components, `async` server components for the initial
> authenticated render, Route Handlers for the weather proxy, Turbopack dev. Pin the exact 16.x in
> `package.json`; if any plugin lags 16, the architecture is unaffected.

## 2. Architecture

```
[ Two phones / browsers ]
        │  HTTPS
        ▼
[ Next.js 16 app @ yakpack.<subdomain> ]
    ├─ Server: auth render, /api/weather proxy (caches Open-Meteo)
    └─ Client: Supabase realtime, optimistic UI, theme
        │                         │
        ▼                         ▼
[ Supabase: Postgres + Auth + Realtime ]   [ Open-Meteo API ]
```

- List reads/writes go client → Supabase under **RLS**; a realtime subscription mirrors changes to the other device.
- Weather is fetched through a **Next.js Route Handler** (`/api/weather?lat&lon`) that caches Open-Meteo
  responses (e.g. revalidate 30–60 min) so both users share one cached call and it works offline-after-first-load.

## 3. Data Model

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('kritish','partner')),
  color text not null default 'accent',
  created_at timestamptz default now()
);

create table categories ( id serial primary key, name text not null, icon text, sort_order int not null );

create table items (
  id uuid primary key default gen_random_uuid(),
  category_id int not null references categories(id),
  name text not null, note text, qty text,
  status text not null default 'standard' check (status in ('owned','to_buy','standard')),
  assigned_to text not null default 'shared' check (assigned_to in ('kritish','partner','shared')),
  scope text not null default 'shared' check (scope in ('each','shared')),
  carry_tags text[] default '{}',          -- e.g. {'rain','cold','uv'} to link weather rules → items
  sort_order int not null default 0,
  is_custom boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table packed (
  item_id uuid not null references items(id) on delete cascade,
  user_key text not null,                  -- 'kritish' | 'partner' | 'shared'
  packed boolean not null default false,
  packed_at timestamptz,
  primary key (item_id, user_key)
);

-- itinerary (one row per leg, from 02_itinerary.md)
create table itinerary (
  day int primary key,
  date date,
  leg text not null,
  lat double precision not null,
  lon double precision not null,
  altitude_m int,
  highlights text,
  carry_today text[] default '{}',         -- item names or carry_tags
  prep_tonight text,
  warnings text,
  network text,                            -- good | weak | none
  fun text,
  tip text
);

create table trip (
  id int primary key default 1,
  name text, depart_date date,
  coordinator_name text, coordinator_phone text,
  leader_name text, leader_phone text
);
```

### RLS (gating)
```sql
alter table items, packed, categories, itinerary, trip enable row level security;  -- (run per-table)
create policy "authed read"  on items     for select using (auth.role() = 'authenticated');
create policy "authed write" on items     for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- repeat for packed/categories/itinerary/trip; profiles readable by authed, writable by self.
```

## 4. Auth & Gating (two users)
- Supabase Auth (email/password or magic link). **Disable public sign-ups** and **pre-create the two
  accounts** (Kritish + partner) — that's the gate. Optional `allowed_emails` trigger as backup.
- Next.js **middleware** protects all routes except `/login`. Map `auth.uid()` → `profiles.role`.

## 5. Today-screen Logic (itinerary + weather)
```ts
// 1. which leg are we on?
const todayLeg = itinerary.find(d => isSameDay(d.date, new Date())) ?? manualOverrideLeg;
// 2. live weather via cached route handler
const wx = await fetch(`/api/weather?lat=${todayLeg.lat}&lon=${todayLeg.lon}`).then(r=>r.json());
//    Open-Meteo params: current=temperature_2m,weather_code,wind_speed_10m,apparent_temperature
//    daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max
// 3. reactive carry list = static carry_today  ∪  weather rules:
//    temp_min < 5 || altitude > 4000  → add cold gear (down jacket, thermals, gloves)
//    precipitation_probability_max ≥ 50 → add rain cover / raincoat
//    uv_index_max ≥ 6 → add sunscreen, sunglasses, lip SPF
// 4. tomorrow = itinerary[day+1] → name, forecast min, prep_tonight
```
- `carry_tags` on items let the weather rules resolve to real, tickable packing items.

## 6. Hosting on a Subdomain
**Vercel (recommended):** push to GitHub → import → set env vars → Domains → add `yakpack.kyrex.org` →
add the CNAME (`yakpack` → `cname.vercel-dns.com`) in DNS → auto-HTTPS.
**Self-host (Docker + Caddy):** Next.js standalone image; Caddy auto-TLS:
```
yakpack.kyrex.org { reverse_proxy app:3000 }
```
Point an A record for `yakpack` at the server IP. Supabase stays cloud (or self-host it too).

## 7. Project Structure
```
yakpack/
  app/
    (auth)/login/page.tsx
    (app)/page.tsx            # Today
    (app)/pack/page.tsx
    (app)/to-buy/page.tsx
    (app)/plan/page.tsx
    api/weather/route.ts      # Open-Meteo proxy + cache
    layout.tsx
  components/                 # TodayHero, CarryChips, ItemRow, CategoryCard, PemBa, WeatherIcon, ProgressBar...
  lib/supabase/ , lib/weather.ts , lib/seed.ts   # seed parses 01 + 02
  supabase/migrations/*.sql
  styles/tokens.css
  public/manifest.json, yak-icons
  middleware.ts , README.md
```

## 8. Env
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-only seed
# Open-Meteo needs no key
# --- AI layer (server-only; see 07_ai_integration.md) ---
AI_ENABLED=true
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-5.5
AZURE_OPENAI_API_VERSION=2024-10-21
# --- Voice layer (server-only; see 08_voice_ai.md) ---
VOICE_ENABLED=true
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
AZURE_TTS_VOICE=MAI-Voice-1
AZURE_STT_MODEL=MAI-Transcribe-1.5
```

## 9. Testing & Quality
- Seed test: item + itinerary counts match `01`/`02`.
- Two-browser realtime test (tick A → B < 1s).
- Weather: mock Open-Meteo in tests; verify carry-rule logic (cold/rain/UV thresholds).
- Lighthouse PWA + a11y ≥ 90; keyboard + screen-reader pass; reduced-motion path.

## 10. AI Layer (Azure OpenAI)

An optional intelligence layer — **full spec in `07_ai_integration.md`**. Summary: server-only Azure
OpenAI (model swappable via env — GPT-5.5/5.4/4o) behind Route Handlers (`/api/ai/briefing`, `/chat`,
`/gaps`, `/parse-item`), using the **Vercel AI SDK** (`@ai-sdk/azure`) with **streaming + tool calling**
so responses are grounded in live weather + itinerary + packing state. Features: Pemba's daily briefing,
Ask-Pemba chat, smart gap alerts, natural-language add. Gated by `AI_ENABLED`; on missing key or error,
the app falls back to the rule-based Today logic. Caching + rate-limits + medical caution as in §07.

## 11. Itinerary Import (by URL) — reusable for any trip

Don't hardcode the plan — let users **import a Zostel batch by URL** so YakPack works for future trips too.
The Zostel page is client-rendered + API-driven, so:

1. **Server route** `/api/itinerary/import?url=` (either user).
2. **Fetch:** prefer Zostel's underlying JSON API (the trip page hydrates from `zo.xyz` — inspect the network
   calls); else fetch the **rendered page text** (headless render or a text-extraction fetch).
3. **AI-extract:** pass that text to the AI layer (`07`) with a structured-output schema →
   `{ day, date, leg, locations[] }`. Works for any operator, even **pasted** text.
4. **Geocode:** resolve each location → lat/lon via **Open-Meteo's free geocoding API**.
5. **Upsert** into `itinerary`; Today/Plan update automatically. Store `source_url` + `imported_at` for re-sync.

Always offer a manual **"paste itinerary"** fallback (textarea → same AI-extract path).

## 12. Voice Layer (MAI-Voice / MAI-Transcribe)

Optional — **full spec in `08_voice_ai.md`**. Server-only Azure **Speech** (Foundry) resource: `MAI-Voice-1/2`
TTS narrates Pemba's briefing + chat (cached per leg+date); `MAI-Transcribe-1/1.5` powers mic input into
Ask-Pemba (43 languages incl. Hindi). Optional Azure **Voice Live API** for real-time voice. Route Handlers
`/api/voice/tts` + `/api/voice/stt`; gated by `VOICE_ENABLED`; falls back to the browser Web Speech API or
text-only. Needs network, so briefing audio is pre-cached for the dead zones.
