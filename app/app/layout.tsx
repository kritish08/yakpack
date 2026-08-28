import Link from 'next/link'
import { Settings } from 'lucide-react'
import { AI_ENABLED } from '@/lib/ai'
import { ensureTripContext, listTrips } from '@/lib/trip'
import TripSwitcher from '@/components/app/trip-switcher'
import ThemeToggle from '@/components/theme-toggle'
import PageTransition from '@/components/page-transition'
import OfflineIndicator from '@/components/offline-indicator'
import OfflineSync from '@/components/offline-sync'
import BottomNav from '@/components/bottom-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // A user can arrive authenticated but trip-less when signup and email
  // confirmation are separated. Fill that gap here rather than dead-ending them.
  const ctx = await ensureTripContext()
  const trips = await listTrips()

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <OfflineIndicator />
      <OfflineSync />
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="min-w-0 flex flex-col">
          <span className="font-display font-bold text-lg uppercase tracking-tight text-text leading-none">
            YakPack
          </span>
          <TripSwitcher trips={trips} currentName={ctx.trip.name} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-label="Pemba the yak">🐂</span>
          <Link
            href="/app/settings"
            aria-label="Settings"
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <Settings size={18} aria-hidden="true" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <PageTransition>{children}</PageTransition>
      </main>

      {/* Bottom tab bar */}
      <BottomNav aiEnabled={AI_ENABLED} />
    </div>
  )
}
