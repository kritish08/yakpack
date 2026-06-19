# YakPack v1 Pre-Prod Audit — Consolidated Verdict

Five parallel review agents (security, data-model, AI, offline/deploy, frontend/a11y).
Findings below are **re-graded with my own verification** — several agent "BLOCKER/NO-GO"
calls were false positives (noted). Severities here are the authoritative ones.

## Verdict: **CONDITIONAL GO**
No crash/data-corruption blockers survive verification. But the app ships to **two
phones**, so the mobile-fit and installability fixes (P0) should land first. Everything
else is a fast-follow.

---

## False positives (verified — NOT real)
- **Dark-mode amber broken (frontend H5)** — FALSE. `tokens.css` imports after `globals.css`; at equal specificity its `:root --accent:#d4943a` wins over the shadcn `[data-theme="dark"]` override. Amber renders correctly (matches live screenshots). *Latent fragility only* — if import order flips it'd break; worth a defensive `[data-theme="dark"]` block in tokens.css someday.
- **`/api/ai/plan-insight` doesn't exist (frontend M4)** — FALSE. It was built last cycle; route exists and works.
- **New items un-packable (data BLOCKER 1)** — FALSE. `pack-screen.handleToggle` inserts the `packed` row on first tap per user_key; "no row" == "not packed" which is the correct display. Self-heals. (Pre-seeding rows on add is still tidier — see P2.)
- **`/api/weather` public/unauth (security H2)** — MOSTLY FALSE. The proxy matcher covers `/api/weather`; unauthenticated requests get redirected to `/login`. And it proxies keyless Open-Meteo anyway.
- **briefing/gaps `revalidate` serves stale across days (AI BLOCKER 1)** — OVERSTATED. Max 1h/30min staleness, same data for both users, self-corrects. Downgraded to LOW.

---

## P0 — fix before the two phones (real, user-facing on mobile)
1. **No safe-area insets** (frontend C3) — bottom nav + page content clip behind the iPhone home indicator. Add `env(safe-area-inset-bottom)` to the nav and chat input bar. `app/(app)/layout.tsx`, `chat-screen.tsx`.
2. **Chat input bar `z-40` < nav `z-50`** (frontend C1) — can be painted over when the keyboard opens. Bump to `z-[55]`. `chat-screen.tsx`.
3. **PWA icons are SVG-only** (offline HIGH) — no 192/512 PNG and iOS ignores the SVG apple-touch-icon → not cleanly installable, no iOS home-screen icon, Lighthouse PWA fail. Add `icon-192.png`, `icon-512.png` (one `any`, one `maskable`) + PNG apple-touch-icon; update `app/manifest.ts` + `app/layout.tsx`.
4. **`user-scalable=no` / `maximum-scale=1`** (offline MEDIUM) — a11y fail + pinch-zoom disabled. Remove from `app/layout.tsx` viewport.

## P1 — correctness & resilience (real, should fix)
5. **Today "packed" ignores user_key** (data M12) — `lib/today.ts` counts an item packed if *either* user packed it. Filter to `[role,'shared']`.
6. **EditItemSheet hard-codes `'kritish'`** (data M10 / frontend H3) — partner editing an item to "Individual" mis-assigns it to Kritish. Pass `profile.role`. `components/pack/edit-item-sheet.tsx:121`.
7. **Chat can stick on a stream error** (AI H4) — Azure 429/timeout mid-stream leaves `status==='streaming'`, input disabled forever (very plausible on Spiti signal). Add `useChat onError` → surface an error bubble + re-enable input. `chat-screen.tsx`.
8. **Ask-screen briefing never loads in prod** (offline MEDIUM) — `ask/page.tsx` does a cookieless server-side `fetch(SITE_URL/api/ai/briefing)` → 401. Call the generator directly (extract to `lib/`) instead of an HTTP round-trip.
9. **`manifest.webmanifest` is auth-gated** (offline LOW) — proxy matcher excludes `manifest.json` not `.webmanifest`. Fix the matcher so guests can fetch it.
10. **`lib/ai.ts` logs the Azure endpoint** on every model build — remove/gate the `console.log`.
11. **`gaps` route missing `PEMBA_SYSTEM`** (AI) — pass `system: PEMBA_SYSTEM` to its `generateObject` for the medical guardrail (inline prompt is weaker).

## P2 — fast-follow (real but acceptable for v1)
- **Offline write replay queue** (offline HIGH, already disclosed) — packed toggles made offline aren't queued; lost on reload. Build an IndexedDB outbox replayed on `online`, or show "not saved — reconnect" toast.
- **`updateItem` scope change doesn't reconcile `packed` rows** (data B2) — switching shared↔each can desync packed state until re-toggled.
- **To-buy mutations don't `router.refresh`** (data H3) — partner's Summary doesn't reflect mark-bought/not-buying until reload (no realtime there).
- **Realtime: add UPDATE handler + memoize the supabase client** (data H4).
- **Per-person progress bars are identical** (data M7) — seed sets every item `assigned_to='shared'`, so "my items" == "all items" for both. Design decision: parse real assignment or relabel.
- **Chat history token growth** (AI #9) — old convos resend full packing-list tool blobs; trim history server-side before `convertToModelMessages`.
- **Defense-in-depth**: add `getUser()` guard to server actions (security H1, already gated by proxy+RLS); sanitize item names fed to AI tools (security M2/M3); `AI_ENABLED` guard inside `PlanAiInsight` + hide the "Ask" tab when AI off.
- **a11y polish**: icon buttons `title`→`aria-label`; bump 28/40px touch targets to 44px; `OfflineIndicator` `role="alert"`.

## Ops (you, in dashboards — not code)
- Confirm `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in Vercel (app 500s if absent).
- Set `NEXT_PUBLIC_SITE_URL=https://yakpack.tech`.
- Enable Supabase **leaked-password protection**; confirm **public signup disabled**.
- `rm -rf .claude/worktrees/*` — 1.5 GB of gitignored agent worktrees bloating the tree.

## What's solid (agents confirmed)
RLS model + the new function/table hardening; service-role & Azure keys are server-only; CSP/security headers; v6 tool-call confirm gating (writes need explicit user confirm); SW cache strategy + safe update loop; AI_ENABLED gating of all AI *surfaces* (minus the cosmetic "Ask" tab); medical guardrail in chat/briefing/plan-insight.
