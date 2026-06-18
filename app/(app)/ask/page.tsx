import { AI_ENABLED } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'
import ChatWrapper from '@/components/ask/chat-wrapper'

async function fetchBriefing(): Promise<string | null> {
  if (!AI_ENABLED) return null
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/ai/briefing`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.briefing ?? null
  } catch {
    return null
  }
}

interface AskPageProps {
  // Next.js 16: searchParams is async.
  searchParams: Promise<{ day?: string }>
}

export default async function AskPage({ searchParams }: AskPageProps) {
  if (!AI_ENABLED) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-4 pb-20">
        <span className="text-5xl">🐂</span>
        <p className="font-display font-bold text-lg uppercase tracking-tight text-text">Pemba is resting</p>
        <p className="font-mono text-xs text-text-muted leading-relaxed max-w-xs">
          AI features are not enabled. Set <code className="text-accent">AI_ENABLED=true</code> in your environment to wake up Pemba.
        </p>
      </div>
    )
  }

  const { day } = await searchParams
  const dayNum = day ? Number(day) : NaN

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [briefing, { data: firstCategoryRaw }, legRes] = await Promise.all([
    fetchBriefing(),
    (supabase.from('categories') as any).select('id').order('sort_order').limit(1).single(),
    Number.isInteger(dayNum)
      ? supabase.from('itinerary').select('day, leg').eq('day', dayNum).single()
      : Promise.resolve({ data: null }),
  ])
  const defaultCategoryId = (firstCategoryRaw as { id: number } | null)?.id ?? 1

  // Deep-linked from the Plan screen (?day=<n>) — pre-fill (not auto-send) the
  // chat input with a contextual prompt for that leg so Pemba answers specifically.
  const leg = (legRes as { data: { day: number; leg: string } | null }).data
  const initialInput = leg
    ? `Tell me about Day ${leg.day} — ${leg.leg}: what should I prepare and carry?`
    : undefined

  return (
    <div className="flex flex-col h-full">
      <ChatWrapper briefing={briefing} defaultCategoryId={defaultCategoryId} initialInput={initialInput} />
    </div>
  )
}
