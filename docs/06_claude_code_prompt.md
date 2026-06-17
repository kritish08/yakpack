# Claude Code — Build Prompt for "YakPack"

> Paste everything below into Claude Code from the root of an empty repo, with the six `yakpack-spiti-app`
> Markdown files present (in `/docs`). Build in milestone order.

---

## Prompt

You are building **YakPack** 🐂 — a polished, two-person **Spiti trip companion** web app for a 9-day
Kinnaur–Spiti trip (departure **June 19**). It combines a real-time collaborative **packing list** with an
itinerary-aware **"Today"** screen that shows live weather, what to carry today, tomorrow's heads-up,
warnings, dawn/dusk, a tip, and a fun thing — fronted by **Pemba the yak** mascot. This is a personal,
portfolio-grade project: it must be genuinely well-built, **flawless UI/UX**, beautiful in **dark and
light** mode, **mobile-first**, real-time, **login-gated to exactly two users**, installable as a **PWA**,
and deployed to a **subdomain**.

### Read these first (in `/docs`)
- `01_packing_list_master.md` — seed data: categories, items (`status`, `assigned_to`, `scope`, carry tags), trip meta, contacts, tips.
- `02_itinerary.md` — the 9-day plan: per-leg coordinates, altitude, `carry_today`, `prep_tonight`, `warnings`, `network`, dawn/dusk, `fun`. **This drives the Today screen.**
- `03_project_plan.md` — scope, user stories, milestones M0–M7, definition of done.
- `04_tech_plan.md` — stack, data model + RLS, auth gating, **Open-Meteo weather + Today logic**, hosting, structure.
- `05_branding_design.md` — YakPack identity, Pemba mascot, color tokens (dark + light), typography, components, motion, the "flawless UX" bar.
- `07_ai_integration.md` — the optional AI layer: Azure OpenAI briefing, Ask-Pemba chat, gap alerts, NL-add; grounding, streaming, fallback, safety.
- `08_voice_ai.md` — the optional voice layer: MAI-Voice TTS (Pemba speaks) + MAI-Transcribe STT (talk to Pemba) via Azure Speech; fallback + offline caveat.

Treat these as the source of truth. When ambiguous, pick the simplest robust option and note it in the README.

### Stack (use unless you flag a strong reason)
**Next.js 16** (App Router, TypeScript) · Tailwind with CSS-variable tokens · shadcn/ui + Lucide ·
next-themes · **Supabase** (Postgres + Auth + Realtime) · **Open-Meteo** for weather (no API key) · next-pwa ·
**Azure OpenAI** via the Vercel AI SDK (`@ai-sdk/azure`) for the optional AI layer (model swappable by env)
+ **Azure Speech** (MAI-Voice / MAI-Transcribe) for the optional voice layer.
Host on **Vercel** with subdomain `yakpack.<domain>` (also include Dockerfile + Caddy for self-host).

### Build order & scope reality (read this first)

The package is ambitious on purpose (it's a fun portfolio project) — but **ship the core before June 19**:
- **Must-ship (M0–M5):** auth (2 users) · seeded packing list with real-time collaborative check-off · the
  itinerary-aware **Today** screen (live weather + carry-today + warnings) · To-Buy · dark/light · deployed
  to the subdomain. This alone is genuinely useful on the trip.
- **High-value next (M6–M8):** Plan timeline + Pemba polish · **AI briefing** + **Ask-Pemba** chat + gap
  alerts. The fun differentiators.
- **Post-trip stretch (M9+):** voice (MAI-Voice/Transcribe) and the URL importer.
- **Explicitly defer — don't let these block a ship:** Voice Live real-time mode, natural-language add, full
  offline *write-sync* with queued mutations, presence/activity feed. They're spec'd; build them later.

Deploy the skeleton to the subdomain at **M0** so it's real from day one, then iterate live.

### What to build (MVP = M0–M5, then M6–M7)
1. **Scaffold** (Next.js 16): wire Tailwind to the exact tokens in `05`; dark default + light + `next-themes`, no flash.
2. **Schema + RLS + seed**: migrations from `04`; seed script parses `01` (list) **and** `02` (itinerary) into
   `categories`, `items`, `packed`, `itinerary`, `trip`. Counts must match.
3. **Auth gate**: Supabase email/password, **public signup off**, two pre-created accounts; middleware-protected routes.
4. **Pack screen**: categorized collapsible cards, tap-anywhere optimistic check-off, status pills, assignee
   chips (Kritish amber / Partner blue / Shared green), per-person vs shared state, **realtime sync** + presence.
5. **Today screen**: detect the current leg (by date, with a manual day-override); fetch **live weather** via a
   cached `/api/weather` Route Handler (Open-Meteo: current temp, hi/lo, feels-like, UV, **sunrise/sunset**,
   wind, precip). Render the hero, **carry-today chips** (static plan ∪ weather rules: cold→down jacket,
   rain→rain cover, UV→sunscreen), **tomorrow's heads-up** + `prep_tonight`, **warning banner**, network/offline
   nudge, **tip + Pemba's fun card**. Carry chips link to the real packing items and show packed state.
6. **To-Buy view** + **progress** (overall / per-person / per-category).
7. **Plan screen**: the 9-day itinerary as a vertical timeline, each day expandable; today pinned.
8. **Pemba** mascot reacting to progress + the playful microcopy; **100%** → Pemba summits + pebble-confetti.
9. **AI layer (M8, optional but recommended — see `07_ai_integration.md`)**: server-only Azure OpenAI via
   the AI SDK. Build `/api/ai/briefing` first (Pemba's grounded daily brief on Today, streamed), then the
   streaming **Ask-Pemba** chat with tool-calling (live weather / itinerary / packing state), then **gap
   alerts**, then **NL-add**. Gate everything behind `AI_ENABLED`; keep the rule-based fallback green and
   hide AI UI when the key is absent. Key stays server-side; bake in the medical-caution system prompt.
10. **Itinerary import (M9, see `04` §11)**: `/api/itinerary/import?url=` that fetches a Zostel batch (or
   pasted text), AI-extracts structured days, geocodes via Open-Meteo, and seeds `itinerary` — so YakPack is
   reusable for future trips. Include a paste fallback.
11. **Voice (M9, see `08_voice_ai.md`)**: server-only Azure Speech — `MAI-Voice` TTS narrates Pemba's
   briefing/chat (cache audio per leg+date); `MAI-Transcribe` STT powers a mic in Ask-Pemba. Gate by
   `VOICE_ENABLED`; fall back to browser Web Speech or text-only.
12. **Phase 2 if time**: custom items (add/edit/delete), notes/qty, activity feed, countdown, full PWA offline
   cache with queued writes + cached last-known weather.

**Also include:** a small **Settings** (theme · auto-narrate · voice on/off · manual "I'm on day N" override)
and frictionless **partner onboarding** — pre-create the two Supabase accounts and share the app URL +
credentials (no public signup).

### Quality bar (Definition of Done — see `03`)
- Live two-device sync verified; Today shows correct live weather + reactive carry list for the current leg.
- Seed matches `01` + `02`; Plan renders all 9 days.
- **Flawless UX:** optimistic + instant, no layout shift, skeletons on weather load, graceful offline, ≥44px
  targets, full a11y, both themes polished. Lighthouse PWA + a11y + best-practices ≥ 90.
- Deployed, gated, HTTPS, on `yakpack.<subdomain>`.
- `README.md`: local setup, env (`.env.example`), seed command, deploy (Vercel **and** self-host), decisions/trade-offs.

### How to work
- Go milestone by milestone (M0→M7); after each, summarize changes + how to verify.
- Tokenized components only (no hardcoded hex). Never commit secrets; service-role key server-side only (seed).
- Ask only if truly blocking; otherwise pick the sensible default and note it.

Start with **M0 (scaffold + theming)** and show me the running shell with a working dark/light toggle.
```
