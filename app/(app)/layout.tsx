'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sun, Package, ShoppingCart, Map, MessageCircle } from 'lucide-react'
import ThemeToggle from '@/components/theme-toggle'

const tabs = [
  { label: 'Today',  href: '/',       icon: Sun },
  { label: 'Pack',   href: '/pack',   icon: Package },
  { label: 'To-Buy', href: '/to-buy', icon: ShoppingCart },
  { label: 'Plan',   href: '/plan',   icon: Map },
  { label: 'Ask',    href: '/ask',    icon: MessageCircle },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="flex flex-col min-h-screen bg-bg">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-display font-bold text-xl uppercase tracking-tight text-text">
          YakPack
        </span>
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-label="Pemba the yak">🐂</span>
          <ThemeToggle />
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-16">
        {children}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 flex bg-surface border-t border-border z-50">
        {tabs.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center min-h-[56px] gap-0.5 text-xs font-body
                ${active ? 'text-accent' : 'text-text-muted hover:text-text transition-colors'}`}
            >
              <Icon size={20} aria-hidden />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
