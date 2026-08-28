import Image from 'next/image'
import Link from 'next/link'
import AltitudeProfile from '@/components/landing/altitude-profile'

const FEATURES = [
  {
    label: 'Packing',
    title: 'The weather decides what surfaces',
    body:
      'Every item carries tags. When the forecast for the day drops below 5 °C or the leg sits above 4,000 m, the down jacket, thermals and gloves move to the top of the list on their own. Rain over 50 % pulls the cover out. UV over 6 pulls the sunscreen.',
    data: 'temp_min < 5 °C  ·  altitude > 4,000 m  →  cold',
  },
  {
    label: 'Two people',
    title: 'Shared items only get packed once',
    body:
      'Each item is yours, theirs, or shared. Personal items track a separate packed state per person; shared items track one. Check something off on your phone and it lands on the other in under a second.',
    data: 'scope: each  →  2 rows   ·   scope: shared  →  1 row',
  },
  {
    label: 'Offline',
    title: 'Built for the days with no signal',
    body:
      'The pack list, the plan and the last known forecast stay readable with the radio off. Check-offs made without signal queue on the device and sync themselves the moment a bar comes back.',
    data: 'Day 7 · Chandratal · 4,300 m · no network',
  },
  {
    label: 'Pemba',
    title: 'An AI guide that can read the actual list',
    body:
      'Ask what to carry tomorrow and Pemba checks the real itinerary, the live forecast and what you have already packed before answering. It can add items too — but every write stops at a confirmation sheet first.',
    data: 'Never prescribes a dose. Altitude sickness questions go to a doctor.',
  },
]

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[100svh] flex flex-col justify-end overflow-hidden">
        <Image
          src="/landing/hero-spiti.webp"
          alt="The Spiti Valley at golden hour: a braided turquoise river below bare ochre mountain slopes, snow peaks on the horizon."
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Two stops rather than one: the lower band has to carry body text, the
            upper only has to keep the fixed nav legible. */}
        <div className="absolute inset-0 bg-gradient-to-b from-bg/85 via-bg/35 to-bg" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg to-transparent" />

        <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8 pb-12 sm:pb-16 pt-28">
          <p
            className="yp-hero-line font-mono text-[10px] sm:text-xs uppercase tracking-[0.24em] text-accent"
            style={{ animationDelay: '0.05s' }}
          >
            9 days · 216 m → 4,590 m · two of them with no signal
          </p>

          <h1
            className="yp-hero-line font-display font-extrabold uppercase tracking-[-0.04em] text-text mt-4 leading-[0.88] text-[clamp(2.75rem,11vw,7rem)]"
            style={{ animationDelay: '0.15s' }}
          >
            Haul it like<br />a yak.
          </h1>

          <p
            className="yp-hero-line font-body text-base sm:text-lg text-text-muted mt-6 max-w-xl leading-relaxed"
            style={{ animationDelay: '0.25s' }}
          >
            A packing and itinerary companion for two people crossing the Spiti Valley.
            It knows the altitude, watches the forecast, and keeps working when the
            mountains take your signal away.
          </p>

          <div
            className="yp-hero-line flex flex-wrap items-center gap-3 mt-8"
            style={{ animationDelay: '0.35s' }}
          >
            <Link
              href="/register"
              className="font-display font-bold text-sm uppercase tracking-tight bg-accent text-bg px-6 py-3.5 rounded-xl hover:brightness-110 active:scale-95 transition-all min-h-[44px] flex items-center"
            >
              Create an account
            </Link>
            <a
              href="https://github.com/kritish08/yakpack"
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono text-sm text-text-muted hover:text-text border border-border hover:border-border-strong px-5 py-3.5 rounded-xl transition-colors min-h-[44px] flex items-center"
            >
              Read the source
            </a>
          </div>

          <div className="mt-12 sm:mt-16">
            <AltitudeProfile />
          </div>
        </div>
      </section>

      {/* ── The trip ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-24 sm:pt-32">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-start">
          <div data-reveal>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
              Why it exists
            </p>
            <h2 className="font-display font-extrabold uppercase tracking-[-0.03em] text-text mt-3 leading-[0.95] text-[clamp(1.9rem,5vw,3.25rem)]">
              The app was written<br />for one specific trip
            </h2>
            <div className="mt-6 flex flex-col gap-4 font-body text-text-muted leading-relaxed max-w-prose">
              <p>
                Nine days from Delhi into the Spiti Valley and back: Shimla, the apple
                orchards of Kinnaur, then the road tips over into cold desert. Tabo,
                Kaza, and the high villages above 4,400 m — Komic, and Hikkim, where
                there is a post office you can mail a postcard to yourself from. It
                arrives weeks after you are home.
              </p>
              <p>
                Two people packing for that is genuinely hard. You need a down jacket
                you will not touch for four days, and a headlamp you will need at
                exactly one campsite. Half the kit is shared and should only be carried
                once. A spreadsheet handles none of this, and phone signal disappears
                on the day the packing matters most.
              </p>
              <p className="text-text">
                So the trip became the spec. Everything here exists because something
                on that road needed it.
              </p>
            </div>
          </div>

          <figure data-reveal className="lg:sticky lg:top-24">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border">
              <Image
                src="/landing/chandratal.webp"
                alt="Chandratal at dusk: a still high-altitude lake below scree slopes, with small tents on the far shore."
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 font-mono text-[11px] text-text-dim leading-relaxed">
              <span className="text-accent-3">Day 7</span> · Chandratal, 4,300 m ·
              coldest night of the trip, and the one place with no network at all.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── What it does ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-24 sm:pt-32">
        <h2 data-reveal className="font-display font-extrabold uppercase tracking-[-0.03em] text-text leading-[0.95] text-[clamp(1.9rem,5vw,3.25rem)]">
          What it actually does
        </h2>

        <div className="mt-10 grid sm:grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden border border-border">
          {FEATURES.map(f => (
            <article key={f.label} data-reveal className="bg-bg p-6 sm:p-8 flex flex-col gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
                {f.label}
              </p>
              <h3 className="font-display font-bold text-lg sm:text-xl uppercase tracking-[-0.02em] text-text leading-tight">
                {f.title}
              </h3>
              <p className="font-body text-sm text-text-muted leading-relaxed flex-1">
                {f.body}
              </p>
              <p className="font-mono text-[11px] text-text-dim border-t border-border pt-3 mt-1 leading-relaxed">
                {f.data}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ── BYOK ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-24 sm:pt-32">
        <div data-reveal className="rounded-2xl border border-accent/25 bg-accent/[0.04] overflow-hidden">
          <div className="grid md:grid-cols-[auto_1fr] gap-6 md:gap-10 p-6 sm:p-10 items-start">
            <div className="relative w-20 h-20 sm:w-28 sm:h-28 shrink-0 mx-auto md:mx-0">
              <Image
                src="/landing/pemba-yak.webp"
                alt=""
                fill
                sizes="112px"
                className="object-contain"
              />
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
                Bring your own key
              </p>
              <h2 className="font-display font-extrabold uppercase tracking-[-0.03em] text-text mt-3 leading-[0.95] text-[clamp(1.6rem,4vw,2.5rem)]">
                Pemba runs on your<br className="hidden sm:block" /> OpenAI key, not mine
              </h2>
              <div className="mt-5 flex flex-col gap-4 font-body text-text-muted leading-relaxed max-w-prose">
                <p>
                  The AI guide is the one part of this that costs real money per
                  message. This is a side project from one trip, so it cannot pay for
                  everyone&apos;s conversations — and an app that quietly burns someone
                  else&apos;s credits is not one worth publishing.
                </p>
                <p>
                  Add an OpenAI key when you sign up and pick the model you want to pay
                  for. Everything else — the pack list, the plan, the offline sync, the
                  weather — works without a key at all.
                </p>
              </div>

              <dl className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-4 font-mono text-xs">
                <div>
                  <dt className="text-text uppercase tracking-wider text-[10px]">Where the key lives</dt>
                  <dd className="text-text-muted mt-1 leading-relaxed">
                    In your browser. It is sent with each request and never written to
                    the database.
                  </dd>
                </div>
                <div>
                  <dt className="text-text uppercase tracking-wider text-[10px]">Which models</dt>
                  <dd className="text-text-muted mt-1 leading-relaxed">
                    Whatever your key can reach — the list is read from your account.
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ── Close ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-24 sm:pt-32">
        <div data-reveal className="border-t border-border pt-12 flex flex-col sm:flex-row gap-8 sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display font-extrabold uppercase tracking-[-0.03em] text-text leading-[0.95] text-[clamp(1.6rem,4vw,2.5rem)]">
              Take it up your<br />own mountain
            </h2>
            <p className="font-body text-text-muted mt-4 max-w-md leading-relaxed">
              The whole thing is open source — schema, offline layer and all. Fork it
              for your own route, or make an account and try this one.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="font-display font-bold text-sm uppercase tracking-tight bg-accent text-bg px-6 py-3.5 rounded-xl hover:brightness-110 active:scale-95 transition-all min-h-[44px] flex items-center"
            >
              Create an account
            </Link>
            <a
              href="https://github.com/kritish08/yakpack"
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono text-sm text-text-muted hover:text-text border border-border hover:border-border-strong px-5 py-3.5 rounded-xl transition-colors min-h-[44px] flex items-center"
            >
              Read the source
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
