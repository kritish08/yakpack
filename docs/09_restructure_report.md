# YakPack — Phase 8 Restructure & Intelligence Report

**Status:** Research complete — no code changed yet.
**Scope:** Four reported issues, root-caused against the codebase, with a phased build plan.
**Date raised:** Day before departure window. Treat data-model fixes (Concern 3) as highest risk.

---

## TL;DR — the four concerns

| # | Concern | Verdict | Severity |
|---|---------|---------|----------|
| 1 | Chat "processing" bar broken / hidden, double yak avatar | **Confirmed bug** — phantom empty assistant row + duplicate avatar | High (visible, on every reply) |
| 2 | Plan section has no real intelligence / interactivity | **Confirmed gap** — AI only on today's card, dead "Ask" link | Medium |
| 3 | "Still to buy" and "Pack" are the same items; deleting in one destroys the other | **Confirmed data-model bug** — hard delete on a shared row | **Critical** (destroys user data) |
| 4 | Today stats look static / don't show their location | **Confirmed UX gap** — data is live but unlabeled | Medium |

---

## Concern 1 — Chat processing indicator is broken

### What the user sees
Image #17: two yak avatars stacked — an empty one, then the "…" typing bubble below it. The processing state looks duplicated and partly hidden.

### Root cause
In `components/ask/chat-screen.tsx`:

1. **Phantom avatar.** Every assistant message renders its avatar unconditionally (`m.role === 'assistant'` → avatar block), then maps its parts. While a reply is still streaming tool calls (or before the first text token), **all parts render `null`** (client-tool parts return `null`, in-progress read-tool chips may not be present yet). Result: an assistant row with an avatar and an empty bubble column.
2. **Duplicate avatar.** Separately, the typing-dots block (`status === submitted/streaming && noVisibleText`) renders **its own** yak avatar + dots. So when an empty assistant message already exists, we get **two avatars**: the phantom empty one + the typing indicator.
3. **Possible occlusion.** The messages container pads the bottom by `NAV_H + INPUT_BAR_H + 16`, and the input bar is `position: fixed; bottom: 56px`. When the indicator is the last element, auto-scroll (`scrollIntoView`) can leave it tucked just under the fixed input bar on short viewports → "the bar gets hidden."

### Fix plan — Phase 1
- **1a.** Suppress rendering of an assistant message row that has **zero renderable content** (no text parts, no visible read-tool chip). No lone avatars.
- **1b.** Merge the typing indicator **into** the active assistant bubble so there is exactly **one** avatar: avatar → dots, then dots get replaced by streaming text in place.
- **1c.** Scroll fix: scroll the dedicated bottom sentinel into view with `block: 'end'` and enough bottom padding so the indicator clears the fixed input bar on all viewport heights.
- **1d.** Keep the read-tool progress chips ("reviewing your packing list…") but render them inside the same single bubble, not as extra rows.

**Files:** `components/ask/chat-screen.tsx` (render logic only; no transport/tool changes).

---

## Concern 2 — Plan section lacks intelligence & interactivity

### Current state (researched)
- `app/(app)/plan/page.tsx` fetches weather for today + next 3 legs and streams a single AI insight **only for today's leg** (`PlanAiInsight`, 24 h cache).
- `components/plan/day-card.tsx` renders static itinerary fields (highlights, warnings, tip, fun, prep_tonight), weather badges, a rule-based "High alt" badge, and an **"Ask Pemba about this day →" link that points to bare `/ask`** — it passes **no day context**, so Pemba can't actually answer "about this day."
- No per-day AI for days 2–9. No AMS/acclimatisation reasoning from altitude deltas. No trip-level readiness view.

### Available data not yet used
`itinerary` table has per-leg `lat/lon`, `altitude_m`, `network`, `warnings`, `carry_today`, `prep_tonight`, `tip`, `fun`. Altitude deltas between consecutive legs are computable (AMS risk). All present, none reasoned over beyond today.

### Fix plan — Phase 2
- **2a. Context-aware "Ask about this day".** Deep-link `/ask?day=<n>` (or a prefilled prompt) so the chat opens seeded with that leg's context and Pemba answers specifically.
- **2b. On-demand per-day insight.** Tap any day card → stream a Pemba insight for that leg (not just today). Lazy: only generate when expanded, cache per leg+date.
- **2c. AMS / acclimatisation intelligence.** Compute altitude gain vs the previous sleeping leg; flag risky jumps (>~800 m/day above 3,000 m or sleeping >3,500 m after a big gain) with a rule-based badge **plus** an AI note on hydration/pacing (no medication doses — honor `PEMBA_SYSTEM` medical guardrail).
- **2d. Trip-readiness header (optional).** One AI line at the top: "9 days, peak 4,551 m at Kunzum La, two fully-offline nights — here's what matters." Cached per trip+date.
- **2e. Interactivity polish.** Expand/collapse day details; tapping a weather badge explains the carry implication.

**Files:** `app/(app)/plan/page.tsx`, `components/plan/plan-screen.tsx`, `components/plan/day-card.tsx`, `components/plan/plan-ai-insight.tsx`, `app/(app)/ask/page.tsx` + `chat-wrapper.tsx` (accept `?day=`/seed prompt). New: a small AMS helper in `lib/plan.ts`.

---

## Concern 3 — "Still to buy" and "Pack" are coupled; deleting destroys originals  ⚠️ CRITICAL

### Root cause (confirmed in schema + code)
There is **one** `items` table (`supabase/migrations/...initial_schema.sql`) with `status ∈ {owned, to_buy, standard}`. Both screens read the **same rows**:

- **Pack** (`lib/pack.ts` → `getPackData`): all items grouped by category, regardless of status.
- **Summary "Still to buy"** (`lib/tobuy.ts` → `getToBuyData`): the same items **filtered to `status='to_buy'`**.

So an item with `status='to_buy'` appears in **both** lists — it is literally one row. The Summary screen's delete (`components/tobuy/to-buy-screen.tsx` → `handleDelete` → `app/actions/items.ts` → `deleteItem`) runs `DELETE FROM items WHERE id=…` (plus its `packed` rows). That **permanently removes the item from the entire app**, including the master Pack list.

> This is exactly the reported "things are deleted from my original list while trying to delete from Still to buy." The trash icon in the shopping view is a destructive master delete wearing a "remove from shopping list" costume.

Note: `items.is_custom` distinguishes seeded master items (`false`) from user-added (`true`). Today nothing protects seeded items from deletion.

### Mental-model fix
"Still to buy" is a **filtered view** of the master list, not a separate list. Removing something from it should change **status**, never delete the row.

| Action in "Still to buy" | Today (wrong) | Proposed |
|---|---|---|
| ✓ Mark bought | status → `owned` (correct, keep) | keep |
| 🗑 "remove from shopping list" | **hard DELETE everywhere** | status `to_buy → standard` (stays in Pack) |
| True delete | — | only from **Pack** screen, with "removes everywhere" warning |

### Fix plan — Phase 3
- **3a.** Remove hard delete from the "Still to buy" view. Replace the trash action with **"Not buying / already have"** → `updateItem(id, { status: 'standard' })`. Item leaves the shopping view but **remains in Pack**.
- **3b.** Keep ✓ "Mark bought" → `status: 'owned'`.
- **3c.** Reserve destructive delete for the **Pack** screen only (it already has a `window.confirm`). Strengthen its copy to "Delete from your whole pack list? This removes it everywhere." Optionally guard seeded items (`is_custom=false`) behind an extra confirm.
- **3d.** AI write-tools alignment: the chat's `deleteItem` tool should match the new semantics (chat "remove from shopping list" → status change, not destroy). `markAsBought` already correct.
- **3e.** Add a subtle caption on each shopping-list row — e.g. "in Pack · Toiletries" — so it's visually obvious it's the same item, not a throwaway entry.

**Files:** `components/tobuy/to-buy-screen.tsx`, `app/actions/items.ts` (maybe add `removeFromShopping`), `components/ask/chat-screen.tsx` + `app/api/ai/chat/route.ts` (tool semantics), `components/pack/pack-screen.tsx` (delete copy).

### Concern 3b — Section restructure on the Summary screen
Current Summary stacks: overall progress → per-person → **AI risk check** → **Still to buy (with destructive CRUD)** → category breakdown → manage categories. The shopping list sitting between stat cards, with destructive controls, is what reads as "confusing / connected."

Proposed order & framing:
1. **Trip readiness** (overall + per-person progress) — pure stats.
2. **Pemba's risk check** (AI gaps) — advisory.
3. **Shopping list** — clearly titled "To buy before we leave", non-destructive actions only, each row tagged with its Pack category.
4. **By category** (progress breakdown) — read-only.
5. **Manage categories** — clearly separated admin section (its own heading/spacing).

---

## Concern 4 — Today stats look static / don't show their location

### Root cause
The data **is** live: `app/(app)/page.tsx` → `fetchWeather(todayLeg.lat, todayLeg.lon)` pulls Open-Meteo per the current itinerary leg (30-min revalidate). But:

- `components/today/weather-hero.tsx` renders the numbers (temp/UV/rain/altitude) with **no location label** — nothing says *where* these are for.
- The leg name lives in a **separate** `LegCard` below, so the stats read as disconnected/static.

### Fix plan — Phase 4
- **4a.** Add a header to `WeatherHero`: **leg/place name + "Day N" + elevation** (e.g. "Kaza · Day 4 · 3,650 m"), so the stats are visibly tied to the itinerary location.
- **4b.** Add a freshness line ("live · updated <local time>") so it reads as dynamic, not hardcoded.
- **4c.** Show coordinates or a small location glyph; confirm altitude shown equals `todayLeg.altitude_m`.
- **4d. (optional)** Manual leg override/selector to preview another day's conditions from Today (the codebase already references a `manualOverrideLeg` concept in CLAUDE.md but it isn't wired).

**Files:** `components/today/weather-hero.tsx` (pass `leg` in from `page.tsx`), `app/(app)/page.tsx`.

---

## Build sequencing

Recommended order — safest, highest-impact first:

1. **Phase 3 (data model)** — stop destroying master items. Ship 3a–3c first; it's the only data-loss bug. Then 3d–3e and the Summary restructure (3b).
2. **Phase 1 (chat indicator)** — small, self-contained, very visible.
3. **Phase 4 (Today location labelling)** — small, clarifies an existing-but-invisible feature.
4. **Phase 2 (Plan intelligence)** — largest; do last, iteratively (2a → 2b → 2c → 2d/2e).

The rule-based experience must stay green with `AI_ENABLED=false` throughout (Plan/Today degrade to static; shopping-list semantics are AI-independent).

## Risks & checks
- **Data migration:** none required — Concern 3 is purely a change in which mutation we call (status update vs delete). Existing rows are unaffected. No schema change.
- **Chat tool semantics (3d):** verify the AI `deleteItem` confirmation copy matches the new "remove from shopping list" meaning to avoid surprising deletes via chat.
- **Caching:** new per-day Plan insights must be cached per `leg+date` to avoid burning tokens on every scroll.
- **Regression:** after Phase 3, confirm Pack still hard-deletes (with warning) and Summary never does.
