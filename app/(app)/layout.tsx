import Link from 'next/link'
import { Settings } from 'lucide-react'
import { AI_ENABLED } from '@/lib/ai'
import ThemeToggle from '@/components/theme-toggle'
import PageTransition from '@/components/page-transition'
import OfflineIndicator from '@/components/offline-indicator'
import BottomNav from '@/components/bottom-nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <OfflineIndicator />
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-display font-bold text-xl uppercase tracking-tight text-text">
          YakPack
        </span>
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-label="Pemba the yak">🐂</span>
          <Link
            href="/settings"
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
