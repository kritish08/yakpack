'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sun, Package, ShoppingCart, Map, MessageCircle } from 'lucide-react'

const baseTabs = [
  { label: 'Today',   href: '/app',        icon: Sun },
  { label: 'Pack',    href: '/app/pack',   icon: Package },
  { label: 'Summary', href: '/app/to-buy', icon: ShoppingCart },
  { label: 'Plan',    href: '/app/plan',   icon: Map },
]

const askTab = { label: 'Ask', href: '/app/ask', icon: MessageCircle }

export default function BottomNav({ aiEnabled }: { aiEnabled: boolean }) {
  const pathname = usePathname()
  // The "Ask" tab is AI UI — fully absent when AI is off, not degraded.
  const tabs = aiEnabled ? [...baseTabs, askTab] : baseTabs

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 flex bg-surface border-t border-border z-50 pb-[env(safe-area-inset-bottom)]"
    >
      {tabs.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || (href !== '/app' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            aria-label={label}
            className={`flex-1 flex flex-col items-center justify-center min-h-[56px] gap-0.5 text-xs font-body
              ${active ? 'text-accent' : 'text-text-muted hover:text-text transition-colors'}`}
          >
            <Icon size={20} aria-hidden="true" />
            <span aria-hidden="true">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
