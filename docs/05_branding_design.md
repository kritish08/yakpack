# YakPack — Branding & Design System

## The Name

**YakPack** 🐂 — the yak is the Himalayas' original load-hauler, the animal that carries everything across
the high passes. That's the app: it hauls your whole trip — packing, plan, weather, warnings — on its back
so you don't have to. Friendly, a little goofy, unmistakably Spiti.

- **Wordmark:** `YakPack`
- **Tagline:** _"Haul it like a yak."_
- **Trip subtitle (this instance):** _Spiti · June 19_
- **Mascot — Pemba the Yak:** a chunky line-art yak who reacts to progress (sleepy → loaded-up →
  triumphant on a summit at 100%) and delivers the playful microcopy + the daily fun card.
- **Swap options:** Pika, Momo, Kaza, Tsomo.

## Brand Personality

A knowledgeable trail buddy, not a corporate checklist. Microcopy winks ("Pemba says: down jacket tonight,
it's −2°C 🥶") but the information is always crisp and trustworthy. Fun on the edges, flawless at the core.

---

## Color System

Dark-mode first, with a fully-specified warm light mode. Everything via CSS-variable tokens.

### Dark mode (default)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0f0e0c` | App background |
| `--surface` | `#171614` | Cards, rows |
| `--surface-2` | `#1f1d1a` | Raised surfaces, Today hero |
| `--border` | `#2e2a25` | Hairlines |
| `--border-strong` | `#3d3830` | Inputs, focus rings |
| `--text` | `#f0ece4` | Primary text |
| `--text-muted` | `#8a8078` | Secondary text |
| `--text-dim` | `#4a4540` | Labels, meta |
| `--accent` | `#d4943a` | **Primary** amber |
| `--accent-2` | `#4a9e7e` | Success / packed green |
| `--accent-3` | `#9e4a4a` | Warning / to-buy red |
| `--accent-4` | `#4a6e9e` | Info / cold / shared blue |
| `--accent-5` | `#7e4a9e` | Fourth person (partner 3) violet |
| `--accent-dim` | `rgba(212,148,58,0.10)` | Accent tint |

### Light mode (warm paper)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#f7f4ef` | Background |
| `--surface` | `#ffffff` | Cards |
| `--surface-2` | `#f0ece4` | Raised |
| `--border` | `#e0d9ce` | Hairlines |
| `--border-strong` | `#cfc7b8` | Inputs |
| `--text` | `#1a1714` | Primary |
| `--text-muted` | `#6b6158` | Secondary |
| `--text-dim` | `#a89e92` | Labels |
| `--accent` | `#b07d4a` | Primary amber |
| `--accent-2` | `#4a7d6e` | Success |
| `--accent-3` | `#7d4a4a` | Warning |
| `--accent-4` | `#4a6e9e` | Cold/info |
| `--accent-5` | `#6e4a7d` | Fourth person |
| `--accent-dim` | `rgba(176,125,74,0.08)` | Tint |

**Weather-reactive accents:** cold (<5°C) → blue glow on temp; high UV (≥6) → amber UV badge; rain likely →
blue raindrop chip. **Per-person chips:** Kritish → amber, Partner → blue, Shared → green.

## Typography

- **Display / headings:** `Syne` 700–800, uppercase titles, tracking `-0.03em`.
- **Body / UI:** `DM Sans` 300–500.
- **Labels / meta / weather numbers:** `DM Mono` 400–500, tracked.
- Big confident temperature number on the Today hero — `clamp(40px, 9vw, 72px)`.

---

## Screens & Components

**Bottom tab bar (mobile-first):** `Today` · `Pack` · `To-Buy` · `Plan` · `Ask` — top bar holds wordmark, Pemba, theme toggle, presence avatars. (`Ask` = the AI chat; can also be a floating Pemba button.)

### Today (home)
- **Hero:** current leg name, **live temperature** (huge), condition icon, hi/lo, feels-like, **UV badge**,
  **sunrise/sunset**, wind, precip %. Background tints subtly by condition + time of day.
- **Carry-today chips:** the day's must-haves (itinerary + weather rules), each showing packed state; tap → Pack.
- **Heads-up tomorrow:** next leg + forecast low + `prep_tonight`.
- **Warning banner** (red) from `warnings`; **Network strip** with "download offline now" nudge when weak/none.
- **AI Briefing card** (Pemba avatar + streamed morning brief grounded in weather + your gaps + tomorrow;
  "Ask a follow-up →" opens chat) and **gap-alert chips**. _Hidden when `AI_ENABLED=false`._
- **Tip + Fun card** (Pemba).

### Pack
- Collapsible category cards (mono header + `(7/12)`), tap-anywhere rows, status pills, assignee chips,
  optimistic check-off, realtime sync, per-person vs shared state.

### To-Buy
- `to_buy` filter, grouped, own progress — the pre-June-19 shopping list.

### Plan
- 9-day itinerary as a vertical timeline (optional altitude graph), each day expandable to highlights,
  carry list, warnings, dawn/dusk, fun. Today pinned/highlighted.

### Ask Pemba (AI chat)
- Streamed chat bubbles with the Pemba avatar; suggested-prompt chips ("What do I wear tomorrow?",
  "What am I still missing?", "Is Day 6 risky for altitude?"). Answers are grounded via tools (live
  weather, itinerary, packing state). A natural-language **add bar** ("add a sleeping-bag liner…") routes
  through `/api/ai/parse-item` → confirm sheet → inserts items. See `07_ai_integration.md`.
- **Voice (optional):** ▶︎ to hear Pemba read the briefing/reply (MAI-Voice TTS) and a 🎙️ mic to ask
  hands-free (MAI-Transcribe STT) with a live waveform. Gated by `VOICE_ENABLED`; falls back to browser
  speech. See `08_voice_ai.md`.

### Shared components
- Buttons (amber solid / outline / red), progress bars (overall + category + person), presence avatars +
  "Partner is packing…" toast, weather icons (Lucide), Pemba mood states, skeleton loaders.

## Iconography & Motion

- Lucide line icons + a chunky line-art **yak** logo/favicon/mascot (3 moods).
- Motion 150–220ms ease on toggles, theme swap, progress, hero temp count-up. Respect `prefers-reduced-motion`.
- 100% packed → Pemba "summits" + brief pebble-confetti (skippable).

## UX Bar — "Flawless"

- Mobile-first, thumb-reachable, ≥44px targets, tap-anywhere rows.
- Optimistic + instant (no toggle spinners); realtime reconciles quietly.
- No layout shift; skeletons while weather loads; graceful offline (cached last weather + "stale" tag).
- A11y: real checkbox semantics, focus rings, AA contrast both themes, reduced-motion path.
- No-flash theming (`next-themes`), system default + remembered choice.
- Lighthouse PWA + a11y + best-practices ≥ 90.

## PWA

Installable; name "YakPack", theme color `#0f0e0c`, yak favicon. Offline cache so it works in Spiti's dead
zones (read list + itinerary + last-known weather; queue check-offs to sync on reconnect).
