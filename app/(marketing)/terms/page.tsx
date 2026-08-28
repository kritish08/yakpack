import type { Metadata } from 'next'
import LegalPage from '@/components/landing/legal-page'

export const metadata: Metadata = {
  title: 'Terms — YakPack',
  description: 'The terms for using the hosted YakPack app, including safety limits on AI advice.',
}

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Terms" title="Using YakPack" updated="28 August 2026">
      <section>
        <p>
          YakPack is a free, open-source side project offered as-is. Using the hosted app
          means accepting the terms below. The source is under the MIT licence; these terms
          cover the hosted instance.
        </p>
      </section>

      <section>
        <h2>Do not rely on it for safety</h2>
        <p>
          This is the important one. YakPack helps you organise a trip. It is{' '}
          <strong>not a safety system</strong>. Forecasts come from a third party and can be
          wrong. Altitude and route information is entered by hand and can be out of date.
          Mountain travel carries real risk, and high-altitude routes carry more of it.
        </p>
        <p>
          Always defer to your guide, your operator, local authorities and your own judgement.
          Never treat a packing list, a weather chip or an AI answer as a reason to continue
          into conditions you would otherwise turn back from.
        </p>
      </section>

      <section>
        <h2>The AI guide is not medical advice</h2>
        <p>
          Pemba can discuss acclimatisation, altitude sickness symptoms, hydration and rest
          days in general terms. It is instructed never to prescribe medication or doses, and
          to refer any question about drugs such as acetazolamide to a doctor. It is a language
          model and it can still be wrong. <strong>Talk to a doctor before your trip</strong>,
          particularly about altitude medication.
        </p>
      </section>

      <section>
        <h2>Your account and your key</h2>
        <ul>
          <li>Keep your password to yourself. You are responsible for activity on your account.</li>
          <li>An OpenAI key you add is yours, billed to you, and charges you incur are yours to manage. Revoke it from your OpenAI account at any time.</li>
          <li>Do not use the app to store anything unlawful, and do not attempt to reach another account&apos;s data.</li>
        </ul>
      </section>

      <section>
        <h2>Availability</h2>
        <p>
          There is no uptime promise. The hosted instance runs on free tiers and may be slow,
          restarted or taken down. Keep anything you truly cannot lose somewhere else as well.
          If it is shut down, reasonable notice will be posted in the repository.
        </p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>
          To the extent the law allows, the maintainer is not liable for loss or damage arising
          from using the app — including lost data, missed items, or decisions made on the
          strength of anything it displayed. It is provided without warranty of any kind.
        </p>
      </section>

      <section>
        <h2>Self-hosting</h2>
        <p>
          Running your own copy is encouraged and covered by the MIT licence rather than these
          terms. You then own the data, the keys and the responsibility.
        </p>
      </section>
    </LegalPage>
  )
}
