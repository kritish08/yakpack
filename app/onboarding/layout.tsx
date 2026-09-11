import Link from 'next/link'

export const metadata = { title: 'New trip — YakPack' }

/**
 * Onboarding sits outside app/app on purpose.
 *
 * That layout resolves a trip for its header and its tab bar, and this is the
 * one screen a user reaches precisely because they do not have one yet. Nesting
 * it there would mean the layout redirecting to the page that lives inside it.
 *
 * Auth-gated: /onboarding is listed in PROTECTED_PREFIXES in proxy.ts. Being
 * absent from PUBLIC_PATHS is not what gates a route — unlisted paths fall
 * through untouched, which is how this screen was reachable signed out.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-display font-bold text-lg uppercase tracking-tight text-text leading-none">
          YakPack
        </span>
        <Link href="/app/settings" className="font-mono text-xs text-text-muted hover:text-text transition-colors">
          Settings
        </Link>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
