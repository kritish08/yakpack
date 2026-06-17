# YakPack — Spiti Itinerary (Companion Data)

> The day-by-day brain of the app. On login, YakPack figures out **which leg you're on** (by date,
> with a manual override), pulls **live weather** for that location (via Open-Meteo — see `04_tech_plan.md`),
> and surfaces **what to carry today**, **tomorrow's heads-up**, **warnings**, **dawn/dusk**, a **tip**,
> and a **fun thing**.
>
> ✅ **Verified against the live Zostel batch** (Experience Spiti Valley, Ex-Delhi, 8N/9D). The route does
> **not** include Kalpa — Day 3 is a Sangla/Chitkul exploration day and Day 4 runs Sangla → Nako →
> **Lepcha La** → Tabo. Dates below use the **June 19** departure; the in-app **URL importer**
> (see `04_tech_plan.md` §11) can refetch any batch's exact days + dates for future trips.
>
> **Zostel includes:** all inner-line permits · an emergency oxygen cylinder · travel insurance · 6 nights'
> stay · 12 meals (6 breakfast + 6 dinner). **Highway lunches are NOT included** — carry snacks + cash.

## How the app uses each field

- `coords` → Open-Meteo query (current temp, today hi/lo, sunrise/sunset, UV, wind, precip, weather code).
- `carry_today` / `prep_tonight` → highlight these items from the packing list as the day's must-haves.
- `warnings` → red banner on the Today screen.
- `fun` → the day's "something fun" card.
- `network` → show a signal indicator + "download offline now" nudge before dead zones.

---

## Day 1 — Delhi → Shimla (overnight transit)

- **date:** 2026-06-19
- **leg:** Depart Delhi (evening) · overnight Volvo/tempo toward Shimla
- **coords:** Delhi 28.61, 77.21 → Shimla 31.10, 77.17
- **altitude:** 216 m → 2,200 m
- **carry_today:** wallet + cash, IDs, phone + charger, earphones, light jacket, snacks, motion-sickness tab
- **prep_tonight:** download offline maps + Zostel PDFs + playlists **before you lose signal**; power bank charged
- **warnings:** long overnight road; take Avomine/Vomistop if you're prone to motion sickness
- **dawn/dusk:** you'll wake to hill roads — keep a layer handy for the morning chill
- **network:** good until Shimla
- **fun:** kick-off playlist + first round of UNO in the vehicle 🃏

## Day 2 — Shimla / Narkanda → Sangla & Chitkul (Kinnaur)

- **date:** 2026-06-20
- **leg:** Drive into the green Baspa Valley; Chitkul = last inhabited village before the Tibet border
- **coords:** Chitkul 31.35, 78.43 · Sangla 31.42, 78.26
- **altitude:** ~2,700–3,450 m
- **carry_today:** sunglasses + sunscreen (strong sun), light fleece, **raincoat/rain cover** (Kinnaur showers), camera
- **prep_tonight:** first night at altitude — hydrate, easy on food, no alcohol
- **warnings:** first real altitude — go slow; sudden rain possible
- **dawn/dusk:** crisp green-valley mornings; carry the fleece for dawn
- **network:** patchy from here — Jio/BSNL in pockets only
- **fun:** stand at Chitkul, "India's last village," and send a smug photo to the group 😎

## Day 3 — Sangla & Chitkul Exploration (Kinnaur)

- **date:** 2026-06-21
- **leg:** Explore the green Baspa valley — **Chitkul** (India's last village before Tibet) and Sangla; a
  relaxed day that doubles as acclimatisation before the big climb into Spiti tomorrow
- **coords:** Chitkul 31.35, 78.43 · Sangla 31.42, 78.26
- **altitude:** ~2,700–3,450 m
- **carry_today:** sunscreen + sunglasses, light fleece, **rain layer** (Kinnaur showers), camera, daypack
- **prep_tonight:** big altitude jump into Spiti tomorrow — hydrate well tonight, easy on food/alcohol
- **warnings:** still acclimatising — easy day, don't overexert
- **dawn/dusk:** cool green-valley mornings — fleece at dawn
- **network:** patchy
- **fun:** riverside chai at Chitkul + the "last dhaba in India" photo ☕

## Day 4 — Sangla → Nako → Lepcha La → Tabo (enter Spiti)

- **date:** 2026-06-22
- **leg:** The big transition — green Kinnaur flips to **cold desert** over **Lepcha La**; Nako village &
  lake on the way; into Tabo and its 1,000-year-old monastery (the "Ajanta of the Himalayas"). **No Kalpa.**
- **coords:** Nako 31.88, 78.63 · Tabo 32.09, 78.38
- **altitude:** Sangla ~2,700 m → Nako ~3,625 m → Tabo ~3,280 m
- **carry_today:** **max sunscreen + SPF lip + sunglasses** (brutal UV), thermals start, fleece + shell,
  2L water, wet wipes, motion-sickness tab (long winding drive)
- **prep_tonight:** moisturise heavy — air is bone-dry now; lip balm on
- **warnings:** **big altitude gain + long drive**; dry, dusty, very high UV even when cool
- **dawn/dusk:** noticeably colder nights from here
- **network:** very weak / patchy
- **fun:** candle-lit moment inside the ancient Tabo gompa 🕯️

## Day 5 — Tabo → Dhankar → Kaza

- **date:** 2026-06-23
- **leg:** Dhankar Monastery on a cliff edge; Pin Valley views; into Kaza, Spiti's HQ
- **coords:** Dhankar 32.09, 78.21 · Kaza 32.23, 78.07
- **altitude:** ~3,800 m
- **carry_today:** sunscreen, sunglasses, fleece + shell, water, ORS sachet in the bottle
- **prep_tonight:** ATMs unreliable — make sure cash is on you; tomorrow is the high-village day
- **warnings:** 3,800 m — mild headache normal; hydrate, slow movements
- **dawn/dusk:** cold mornings; full layers at dawn
- **network:** Kaza has the best signal for days — **download anything you need now**
- **fun:** first proper Spiti café — momos + sea-buckthorn tea 🥟

## Day 6 — Kaza local: Langza · Hikkim · Komic · Key · Kibber

- **date:** 2026-06-24
- **leg:** The greatest-hits day — Buddha of Langza, world's highest post office (Hikkim), highest motorable village (Komic), Key Monastery, Kibber
- **coords:** Langza 32.27, 78.08 · Komic 32.27, 78.13 · Key 32.30, 78.01 · Kibber 32.33, 78.01
- **altitude:** 4,400–4,587 m (the highest you'll sleep-adjacent)
- **carry_today:** thermals + fleece + **down jacket** (it's cold up top even at midday), gloves, beanie, sunscreen, water, **oxygen can just in case**
- **prep_tonight:** write your Hikkim postcard tonight so you can post it tomorrow
- **warnings:** **highest-altitude day — AMS risk real.** Move slowly, don't sprint for photos, sip water constantly
- **dawn/dusk:** thin cold air; layer fully before heading out
- **network:** near-zero up in the villages
- **fun:** **post a postcard to yourself from the world's highest post office (Hikkim, 4,440 m)** 📮 — it arrives weeks later as a souvenir

## Day 7 — Kaza → Kunzum Pass → Chandratal

- **date:** 2026-06-25
- **leg:** Cross Kunzum La (4,590 m); camp by the crescent "Moon Lake," Chandratal
- **coords:** Kunzum 32.40, 77.64 · Chandratal 32.48, 77.62
- **altitude:** Kunzum ~4,590 m · Chandratal camp ~4,300 m
- **carry_today:** **everything warm** — thermals, fleece, **down jacket**, **windproof shell**, gloves, beanie, gaiter, thick socks; headlamp; oxygen can
- **prep_tonight:** **coldest night of the trip — sub-zero.** Sleep in thermals + beanie; bottle of warm water in the sleeping bag
- **warnings:** **freezing camp, no network, basic toilets, possible snow at Kunzum.** AMS watch — tell the leader if you feel rough
- **dawn/dusk:** brutal cold at dawn; sunrise over the lake is the payoff
- **network:** **none** — fully offline
- **fun:** **stargazing at Chandratal** — one of the darkest skies in India; the Milky Way is absurd ✨

## Day 8 — Chandratal → Batal → Atal Tunnel → Manali

- **date:** 2026-06-26
- **leg:** The long, rough, beautiful descent out of Spiti via Batal/Gramphu and the Atal Tunnel into green Manali
- **coords:** Batal 32.42, 77.63 · Manali 32.24, 77.19
- **altitude:** 4,300 m → 2,050 m (big drop = relief for your lungs)
- **carry_today:** layers you can shed as you descend, motion-sickness tab (rough road), snacks, water, camera
- **prep_tonight:** back in network land — recharge, back up photos, hot shower 🚿
- **warnings:** longest, bumpiest drive of the trip; river crossings near Batal
- **dawn/dusk:** cold start at the lake, warm by Manali evening
- **network:** returns near Manali
- **fun:** first hot proper meal + celebratory chill in Manali — you survived Spiti 🍻

## Day 9 — Manali → Delhi (overnight)

- **date:** 2026-06-27
- **leg:** Overnight Volvo back to Delhi
- **coords:** Manali 32.24, 77.19 → Delhi 28.61, 77.21
- **altitude:** 2,050 m → 216 m
- **carry_today:** comfy clothes, earphones, snacks, charged power bank, the Hikkim-postcard memory
- **prep_tonight:** —
- **warnings:** overnight drive; keep valuables close
- **dawn/dusk:** wake up back in the plains
- **network:** good
- **fun:** group photo dump + rate-the-trip + plan the next one already 🚀

---

## Derived "Today" screen logic (for Claude Code)

```
todayLeg = itinerary.find(d => d.date === today)  // fallback: manual day picker
weather  = openMeteo(todayLeg.coords)             // current + daily
render:
  - Hero: leg name, live temp + condition icon, hi/lo, "feels-like", UV badge, sunrise/sunset
  - "Carry today" chips  -> link to those packing items (and whether they're packed)
  - "Heads-up tomorrow"  -> tomorrowLeg.name + forecast lo + prep_tonight (e.g. "pull out the down jacket")
  - Warning banner       -> todayLeg.warnings (red)
  - Network strip        -> todayLeg.network (nudge to download offline if 'none'/'weak')
  - Tip of the day + Fun card
```

- If `weather.daily.temp_min < 5` or leg altitude > 4,000 m → auto-emphasise the **down jacket / thermals / gloves**.
- If `weather.daily.precipitation_probability` high → auto-emphasise the **raincoat / rain cover**.
- If `weather.daily.uv_index_max ≥ 6` → auto-emphasise **sunscreen + sunglasses + lip SPF**.
- These rules make the "carry today" list react to *actual* weather, not just the static plan.
