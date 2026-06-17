# YakPack — Master Packing List (Seed Data)

> This is the **single source of truth** for the packing list. Claude Code should parse this file
> into the database seed (see `04_tech_plan.md` → Data Model). It merges three sources:
> Kritish's Spiti Field Guide, his friend's list, and the Zotrip coordinator (Ritvik) list.

---

## Trip Meta

| Field | Value |
|---|---|
| Trip | Experience Spiti Valley (Ex-Delhi) — Kinnaur · Spiti · Chandratal |
| Operator | Zostel / Zotrip |
| Duration | 9 days |
| Departure | June 19 |
| Conditions | 0–20 °C, intense high-altitude UV, very dry air, freezing nights |
| Laundry | None — pack for the full trip |
| Network | Patchy (Jio/BSNL in pockets) — download everything offline first |

## Trip Contacts

| Role | Name | Phone |
|---|---|---|
| Trip Coordinator / POC (Zotrip Ops) | Ritvik | 8197891921 |
| Trip Leader (on-ground) | Sashi | +91 89511 55846 |

---

## Item Status Legend

- `owned` — already sorted / bought / owned (default-checked "acquired")
- `to_buy` — still to get before June 19
- `standard` — everyday item, just remember to pack it

Each item below is written as: **Name** — `status` · _qty/notes_ · assignee-default

Assignee defaults: `shared` unless it's obviously personal (clothing/meds → `each`).

---

## 01 · Bags

- **Main bag — duffel or 60–80L rucksack** — `owned` · _Kritish's duffel works; rides in the vehicle_ · each
- **Small daypack (15–20L)** — `to_buy` · _water, shell, snacks on day walks_ · each
- **Rain cover for bag** — `to_buy` · _Ritvik's list; protects bag on wet Kinnaur stretch_ · each
- **Wet-clothes / laundry bag** — `to_buy` · shared-style, one each
- **Dry bags / zip pouches** — `to_buy` · _electronics + a dry change_ · shared

## 02 · Clothing & Layers

- **Thermal base set (top & bottom) ×1–2** — `owned` · each
- **Full-sleeve t-shirts ×2–3** — `owned` · _warm base, Ritvik's note_ · each
- **T-shirts ×5–6 (palette, darker shades)** — `owned` · each
- **Fleece jacket / hoodie** — `owned` · _navy_ · each
- **Heavy down / puffer jacket (−5 °C)** — `owned` · _critical_ · each
- **Windproof / waterproof shell** — `owned` · _black_ · each
- **Bottoms ×3–4 — cargos + trek pants + jeans** — `owned` · _regular fit for long drives_ · each
- **Shacket / corduroy shirt / bomber** — `owned` · _warm photogenic layers_ · each
- **Night suit** — `to_buy` · each
- **Undergarments ×8–9** — `to_buy` · _full 9 days, no laundry_ · each
- **Belt — canvas (cargos) + leather** — `owned` · each
- **Handkerchief** — `to_buy` · each

## 03 · Footwear & Socks

- **Trekking shoes (high grip, ideally waterproof)** — `owned` · each
- **Slippers / flip-flops (for stays)** — `to_buy` · each
- **Thick woolen / hiking socks ×3–5** — `owned` · each
- **Extra everyday socks** — `owned` · each

## 04 · Head & Extremities

- **Warm cap / beanie** — `owned` · _mustard; evenings_ · each
- **Cap / sun hat (daytime walks)** — `to_buy` · each
- **Muffler / neck gaiter / buff** — `owned` · each
- **Gloves (fleece / windproof)** — `owned` · each
- **Sunglasses (UV / polarized)** — `owned` · _John Jacobs polarized_ · each

## 05 · Toiletries & Hygiene

- **Toothbrush & toothpaste** — `to_buy` · each
- **Comb** — `to_buy` · each
- **Face wash** — `to_buy` · each
- **Shampoo (travel size)** — `to_buy` · each
- **Pocket handwash** — `to_buy` · shared
- **Deodorant** — `to_buy` · each
- **Hand sanitizer** — `to_buy` · shared
- **Wet wipes ×2–3 packs** — `to_buy` · _dry toilets + no-water days_ · shared
- **Pocket tissues** — `to_buy` · shared
- **Quick-dry microfiber towel** — `owned` · each

## 06 · Skincare, Hair & Grooming

- **Sunscreen SPF 50+ & reapply stick** — `owned` · _#1 priority at altitude_ · each
- **Heavy moisturiser / cream + lotion** — `owned` · _very dry weather_ · each
- **Lip balm (SPF) + Vaseline** — `owned` · each
- **Micellar water (no-water cleanse)** — `to_buy` · each
- **Curl cream + spray bottle + serum/styling** — `owned` · each
- **Trimmer + beard oil** — `owned` · _charge it fully_ · each
- **Perfume (75 ml + attar combo)** — `to_buy` · each

## 07 · Health & Altitude

- **Personal medicines** — `to_buy` · each
- **Basic first-aid kit** — `to_buy` · _band-aids, antiseptic_ · shared
- **Paracetamol + cold & cough meds** — `to_buy` · shared
- **Diamox** — `to_buy` · _altitude sickness — consult doctor first_ · each
- **ORS / Electral ×4–5** — `to_buy` · _one in the bottle daily_ · shared
- **Portable oxygen can (optional)** — `to_buy` · _Zostel carries an emergency cylinder; a personal can is an optional extra_ · shared

## 08 · Gadgets & Charging

- **Phone** — `standard` · each
- **Charger(s) + all cables** — `to_buy` · each
- **Car charger** — `to_buy` · _Ritvik's list; charge on drive days_ · shared
- **Power bank 20,000 mAh+** — `owned` · _erratic valley electricity_ · each
- **Earphones / Pods** — `standard` · each
- **Watch charger + spare straps** — `to_buy` · each
- **Torch / headlamp** — `to_buy` · each
- **Camera (optional)** — `to_buy` · _Ritvik's list_ · shared

## 09 · Documents, Money & Offline

- **Wallet** — `standard` · each
- **Cash ₹8,000–10,000** — `to_buy` · _UPI/ATMs fail past Kinnaur_ · each
- **Govt ID — Aadhaar/Passport + 2 photocopies** — `to_buy` · _checkpoints_ · each
- **Inner-line permits** — `owned` · _included by Zostel — no action needed_ · shared
- **Zostel booking PDFs (saved offline)** — `to_buy` · shared
- **Offline Google Maps — Himachal/Spiti** — `to_buy` · each
- **Downloaded music playlists** — `to_buy` · each

## 10 · Hydration, Snacks & Downtime

- **Insulated water bottle / flask** — `owned` · each
- **Snacks / energy bars / dry fruits** — `to_buy` · _Ritvik's list_ · shared
- **Watch** — `standard` · each
- **UNO** — `to_buy` · shared
- **Monopoly (travel edition)** — `to_buy` · shared

---

## Quick Tips (surface these in the app, e.g. a "Tips" tab or footer)

- **Acclimatise properly** — gain altitude gradually; the Kinnaur-first route is designed for this.
- **Stay hydrated** — 3 L/day; dehydration mimics and worsens AMS.
- **Avoid alcohol the first 1–2 days** at altitude.
- **Network is limited** (Jio/BSNL in patches) — download maps, bookings, music before you lose signal.
- **Nights get cold even in summer** — the down jacket + thermals earn their place after dark.
- **The 3 that ruin trips if forgotten:** charge power bank + trimmer the night before · withdraw cash while UPI works · download offline maps + Zostel PDFs on fast data.

---

## Seeding Notes for Claude Code

- Treat each `##` block as a **category** (use the leading number for `sort_order`, strip it for display).
- Parse `status` from the inline code tag; default `assigned_to` from the trailing `each`/`shared`.
- `each` → create the item once but allow per-user packed state (Kritish + partner each tick their own);
  `shared` → a single shared packed state.
- Preserve item order within a category as `sort_order`.
- Store the Trip Meta and Trip Contacts as a `trip` config record; render contacts as tappable `tel:` links.
