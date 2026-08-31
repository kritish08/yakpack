# The trip pack format

A trip in YakPack is two Markdown files:

| File | Becomes |
|---|---|
| `01_packing_list_master.md` | the trip row, its contacts, its categories and items |
| `02_itinerary.md` | the day-by-day plan |

`docs/01` and `docs/02` in this repo are the Spiti trip written in that format. They
are not a special case the seeder knows about — they are one instance of it. Point
`pnpm seed` at a different pair and you get a different trip.

This file is the spec. It exists because the first trip arrived as an operator's PDF
— a coordinator, a leader, nine days, a kit list — and every field below is that PDF
generalised: what any trip pack actually gives you, rather than what one of them did.

---

## 1. Trip meta

```markdown
## Trip Meta

| Field | Value |
|---|---|
| Trip | Ladakh — Leh · Nubra · Pangong |
| Depart date | 2027-05-14 |
| Operator | Self-drive |
| Duration | 8 days |
| Conditions | −5 to 22 °C, high UV, very dry |
| Network | Postpaid only past Leh; no signal at Pangong |
```

Only two rows reach the database: **Trip** → `trips.name`, **Depart date** →
`trips.depart_date` (must be `YYYY-MM-DD`; anything else is stored as-is and will
fail). The rest is context for whoever is packing, and it is worth writing — it is
what tells you why the list looks like it does a year later.

`TRIP_NAME` and `TRIP_DEPART_DATE` in the environment override this table, so a
private deployment can keep its details out of a public repo.

## 2. Contacts

```markdown
## Trip Contacts

| Role | Name | Phone | Note |
|---|---|---|---|
| Homestay, Nubra | Dorje | +91 90000 00000 | Booked, paid 50% |
| Mechanic, Leh | | +91 90000 00001 | Recommended by the rental |
| Insurance | | 1800 000 0000 | Policy in the wallet |
```

`Role` is free text and required. `Name`, `Phone` and `Note` are each optional, but a
row needs at least a name or a number — **a row with neither is skipped**, which is
how the committed Spiti file shows the shape without publishing anyone's number.

There is no fixed set of roles and no limit worth mentioning (the app caps a trip at
20). A contact with a note and no phone is still useful; it renders without a dial
link.

Contacts are also editable in the app at **Settings → Contacts**, so this table is a
starting point, not the only way in.

## 3. Categories and items

```markdown
## 03 · Layers & Warmth

- **Down jacket** — `owned` · _packs to nothing_ · each
- **First-aid kit** — `to_buy` · shared
```

A category heading is `## NN · Name`; the number is its `sort_order` and drives
display order. Headings without that `NN ·` prefix are prose and their bullets are
ignored, which is what lets the meta and contact sections live in the same file.

Each item bullet is:

| Part | Syntax | Meaning |
|---|---|---|
| Name | `**Down jacket**` | required |
| Status | `` `owned` `` / `` `to_buy` `` / `` `standard` `` | defaults to `standard` |
| Note | `_packs to nothing_` | optional |
| Scope | trailing `each` or `shared` | `each` = tracked per person; `shared` = one between you |

`each` versus `shared` is the one that matters. Two people each need a toothbrush;
they need one first-aid kit between them. Get it wrong and the app either nags twice
or lets something be forgotten once.

## 4. Itinerary

```markdown
## Day 3 — Leh → Nubra via Khardung La

- **date:** 2027-05-16
- **lat/lon:** 34.6868, 77.5619
- **altitude_m:** 3050
- **highlights:** Khardung La at 5,359 m; sand dunes at Hunder
- **carry_today:** water, sunscreen, warm layer for the pass
- **prep_tonight:** charge everything; permits in the glovebox
- **warnings:** do not linger at the top of the pass
- **network:** none
- **fun:** the camels are Bactrian, not Arabian
- **tip:** fuel up in Leh — nothing until Diskit
```

`day` comes from the heading. `lat`/`lon`/`altitude_m` are what the AMS logic and the
weather rules run on, so they matter more than they look:

- `altitude_m` above 4000 adds the `cold` carry tag on its own.
- Day-to-day altitude *gain* drives the AMS warning (`lib/ams.ts`), with no AI involved.

⚠️ **Do not trust a geocoder for altitude.** Open-Meteo resolves "Kaza" to Kazan in
Russia at 61 m, and returns nothing at all for Chandratal. The app's importer
therefore *proposes* an elevation and makes you confirm it. When writing this file by
hand, take altitudes from a map, not from a lookup.

`network` is one of `good` · `weak` · `patchy` · `none`.

---

## Creating trips from this format

**Seeded (the template).** `pnpm seed` maintains the one trip flagged
`is_template` — the row every new registration is copied from. It never touches a
real user's trip. Run `pnpm seed --dry-run` first; it prints the parse without
writing.

**In the app.** Trips → New trip. `create_trip()` copies the template's packing list
so you start with a real list rather than an empty screen, and leaves the itinerary
and contacts empty, because someone else's days and someone else's driver are not
yours. Fill the days by hand, paste them into Plan → Import, or add contacts from
Settings.

**At signup.** `create_trip_from_template()` copies the lot — list, itinerary and
contacts — so a new account has something populated to explore.

That difference is deliberate and worth keeping: the packing list generalises across
trips, the route does not.
