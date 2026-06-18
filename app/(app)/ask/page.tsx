import { AI_ENABLED } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'
import ChatScreen from '@/components/ask/chat-screen'

async function fetchBriefing(): Promise<string | null> {
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

export default async function AskPage() {
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

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [briefing, { data: firstCategoryRaw }] = await Promise.all([
    fetchBriefing(),
    (supabase.from('categories') as any).select('id').order('sort_order').limit(1).single(),
  ])
  const defaultCategoryId = (firstCategoryRaw as { id: number } | null)?.id ?? 1

  return (
    <div className="flex flex-col h-full">
      <ChatScreen briefing={briefing} defaultCategoryId={defaultCategoryId} />
    </div>
  )
}
