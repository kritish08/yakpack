import type { Metadata } from 'next'
import LegalPage from '@/components/landing/legal-page'

export const metadata: Metadata = {
  title: 'Privacy — YakPack',
  description: 'What YakPack stores, what it sends to third parties, and how to delete it.',
}

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Privacy" title="What we store" updated="28 August 2026">
      <section>
        <p>
          YakPack is a small open-source side project, not a company. This page describes
          exactly what the running app does with your data. If you self-host it, you are the
          one holding the data and this page describes your copy, not ours.
        </p>
      </section>

      <section>
        <h2>What an account stores</h2>
        <p>When you create an account, the database holds:</p>
        <ul>
          <li>Your <strong>email address</strong> and a hashed password, handled by Supabase Auth. We never see your password.</li>
          <li>A <strong>display name</strong> you choose.</li>
          <li>Your <strong>trip content</strong> — packing items, categories, what is checked off, and your itinerary.</li>
        </ul>
        <p>
          That is the whole list. There is no profiling, no advertising, and nothing is sold or
          shared with anyone.
        </p>
      </section>

      <section>
        <h2>Your OpenAI key</h2>
        <p>
          If you add an OpenAI key to use the AI guide, it is kept <strong>in your browser</strong> and
          attached to each request you make to the AI. It is <strong>never written to the database</strong>,
          never logged, and is not readable by us. Clearing your browser storage removes it, and
          signing in on another device means entering it again.
        </p>
        <p>
          Messages you send to the AI go to OpenAI under your own key and are covered by
          OpenAI&apos;s policies, not ours.
        </p>
      </section>

      <section>
        <h2>What leaves the app</h2>
        <ul>
          <li><strong>Open-Meteo</strong> receives the latitude and longitude of an itinerary stop to return a forecast. No account data is attached.</li>
          <li><strong>OpenAI</strong> receives your AI messages, under your own key, only if you add one.</li>
          <li><strong>Supabase</strong> hosts the database and authentication.</li>
          <li><strong>Vercel</strong> hosts the site and collects anonymous traffic and performance measurements (page views, load timings). This is not tied to your account.</li>
        </ul>
      </section>

      <section>
        <h2>What your device stores</h2>
        <p>
          So the app keeps working without signal, your browser holds a cached copy of your
          pack list, plan and last known forecast, plus any check-offs made offline that have
          not synced yet. AI conversations are kept in your browser only. Clearing site data
          removes all of it.
        </p>
      </section>

      <section>
        <h2>Deleting your data</h2>
        <p>
          Ask for deletion through the repository&apos;s issue tracker or by contacting the
          maintainer, and the account and its trip content are removed. There is no
          retention period and no backup we hold on to afterwards.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If this changes, the date at the top changes with it. The history of this page is
          public in the repository.
        </p>
      </section>
    </LegalPage>
  )
}
