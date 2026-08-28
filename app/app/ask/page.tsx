import { AI_ENABLED } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'
import { getTripContext } from '@/lib/trip'
import ChatWrapper from '@/components/ask/chat-wrapper'

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
  const { tripId } = await getTripContext()
  const [{ data: firstCategoryRaw }, legRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('categories') as any).select('id').eq('trip_id', tripId).order('sort_order').limit(1).maybeSingle(),
    Number.isInteger(dayNum)
      ? supabase.from('itinerary').select('day, leg').eq('trip_id', tripId).eq('day', dayNum).maybeSingle()
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
      <ChatWrapper briefing={null} defaultCategoryId={defaultCategoryId} initialInput={initialInput} />
    </div>
  )
}
