# YakPack — Project Implementation Plan

## 1. Vision

A small, beautiful, **two-person Spiti trip companion**: collaborative packing **plus** an
itinerary-aware "Today" screen that, on login, shows **live weather** for where you are, **what to carry
today**, **tomorrow's heads-up**, **warnings**, **dawn/dusk**, a tip, and a fun thing — fronted by Pemba
the yak. Polished, portfolio-grade, hosted on a subdomain, login-gated, dark/light, installable. Built for
real use on the June 19 trip — and as a fun, ultra-personalised project.

## 2. Users

| User | Needs |
|---|---|
| **Kritish** | Pack collaboratively, see live day/weather/carry info, manage to-buy, read the plan. |
| **Partner** | Equal collaborator — claim/assign/tick items, see the same Today + plan. |

Closed system: **exactly two accounts**, no public signup.

## 3. Core Concepts

- **Packing:** items → categories, with `status` (`owned`/`to_buy`/`standard`), `assignee`
  (`kritish`/`partner`/`shared`), `scope` (`each` = per-person packed, `shared` = one state). Live-synced.
- **Itinerary:** the 9-day plan (`02_itinerary.md`) — each leg has coordinates, altitude, `carry_today`,
  `prep_tonight`, `warnings`, `network`, dawn/dusk, and a `fun` item.
- **Weather:** live per-leg forecast (Open-Meteo) drives a reactive "carry today" list (cold → down jacket,
  rain → rain cover, high UV → sunscreen/sunglasses) on top of the static plan.

## 4. User Stories

**MVP**
1. I log in and land on **Today**: current leg, live temp + conditions, sunrise/sunset, UV.
2. Today shows **carry-today** chips (plan + weather) with packed state; tapping jumps to the item.
3. Today shows **tomorrow's heads-up** (next leg, forecast low, what to prep tonight).
4. Today shows **warnings** (AMS, freezing, no network) and a network/offline nudge.
5. I open **Pack**: categorized list, tap to pack/unpack, partner sees it live.
6. I filter **To-Buy** for the pre-trip shopping list.
7. I assign/claim items; I see overall + per-person progress.
8. I open **Plan**: the full 9-day timeline, each day expandable.
9. I toggle dark/light (remembered); it's flawless on mobile and offline-tolerant.
10. Pemba reacts to progress and serves the daily tip + fun card.

**Phase 2**
11. Add/edit/delete custom items; per-item notes/qty.
12. Presence + "Partner packed X" activity toast/feed.
13. Countdown to June 19; manual "I'm on day N" override for the Today logic.
14. PWA install + offline cache with queued writes; cached last-known weather.

**Stretch**
15. "Pemba summits" 100% celebration; altitude graph on Plan; Hikkim-postcard reminder; trip-template clone.

## 5. Scope (MVP)

**In:** auth (2 users), seeded list + itinerary, Today screen with live weather + carry/warnings/dawn/dusk/
tip/fun, real-time check-off, assignee, to-buy, progress, Plan timeline, dark/light, responsive, deployed
to subdomain.
**Out (MVP):** push notifications, multi-trip, >2 users, payments, native apps.

## 6. Milestones

| # | Milestone | Output |
|---|---|---|
| M0 | Scaffold | Next.js 16 + Tailwind + Supabase + theme toggle |
| M1 | Data + seed | Schema/RLS; seed from `01_packing_list_master.md` + `02_itinerary.md` |
| M2 | Auth gate | Two accounts, login, protected routes |
| M3 | Pack + realtime | Categorized list, optimistic toggle, live sync |
| M4 | Today + weather | Open-Meteo integration, hero, carry-today, heads-up, warnings, network |
| M5 | To-Buy + progress | Filter + bars (overall/person/category) |
| M6 | Plan + Pemba + branding | Itinerary timeline, mascot states, full design pass, motion |
| M7 | PWA + deploy | Installable, offline cache, deployed to `yakpack.<subdomain>`, 2-phone test |
| M8 | AI layer (optional) | Azure OpenAI: Pemba briefing → Ask-Pemba chat → gap alerts → NL-add; rule-based fallback stays green (see `07_ai_integration.md`) |
| M9 | Voice + import (optional) | MAI-Voice/Transcribe (Pemba speaks + talk-to-Pemba) and URL itinerary-import — reusable for future trips (see `08_voice_ai.md`, `04` §11) |

## 7. Definition of Done

- Both users collaboratively pack with **live sync** (verified on two devices).
- Today shows **correct live weather + carry list** for the current leg; rules react to weather.
- Seed matches `01` + `02` exactly; Plan renders all 9 days.
- Dark/light polished; mobile-first; Lighthouse PWA + a11y ≥ 90.
- Deployed, gated, HTTPS, on the subdomain; README covers dev + deploy.

## 8. Risks & Mitigations

- **Weather API offline in Spiti:** cache last-known forecast, show a "stale" tag; the plan's static
  `carry_today` still works fully offline.
- **Wrong day detection:** date-based with a manual day-override picker.
- **Realtime conflicts:** per-person packed state + optimistic + reconcile (last-write-wins).
- **Scope creep:** ship M0–M5 first; Plan polish + Pemba + PWA are M6–M7; AI is M8.

## 9. AI Layer (optional, recommended)

An Azure OpenAI layer (see `07_ai_integration.md`) adds **Pemba's daily briefing**, the **Ask-Pemba**
assistant, **smart gap alerts**, and **natural-language add** — all grounded in live weather + itinerary +
your real packing state. It's gated behind `AI_ENABLED`; with no key the app uses the rule-based Today
logic, so it's a true enhancement, never a dependency. Build as **M8**, after the rule-based Today works.

## 10. Itinerary Import & Voice (optional, recommended)

- **URL import** (`04_tech_plan.md` §11): point/paste a Zostel batch URL → AI extracts the days → geocode →
  seed the itinerary. Makes YakPack **reusable for any future trip**, not just this one.
- **Voice** (`08_voice_ai.md`): Pemba **speaks** the briefing aloud (MAI-Voice) and you can **ask by mic**
  (MAI-Transcribe, incl. Hindi). Both optional/gated with graceful fallbacks. Build as **M9**.
