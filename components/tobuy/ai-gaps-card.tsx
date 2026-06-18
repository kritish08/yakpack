import { generateObject } from 'ai'
import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { AI_ENABLED, getAzureModel } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

type ItineraryRow = Database['public']['Tables']['itinerary']['Row']
type ItemRow = Database['public']['Tables']['items']['Row']

const GapSchema = z.object({
  gaps: z.array(z.object({
    title:           z.string().describe('Short gap title'),
    detail:          z.string().describe('Why this matters for the trip — one sentence'),
    severity:        z.enum(['high', 'medium', 'low']),
    suggested_items: z.array(z.string()).optional(),
  })),
})

type Gaps = z.infer<typeof GapSchema>

const generateGapsCached = unstable_cache(
  async (
    unpackedItems: string[], toBuyItems: string[],
    highAltDays: string[], offlineDays: string[],
  ): Promise<Gaps> => {
    const prompt = `You are analysing a Spiti Valley packing list for two travellers (June 19–27).
Items on the list (${unpackedItems.length}): ${unpackedItems.slice(0, 40).join(', ')}${unpackedItems.length > 40 ? '…' : ''}.
Still to buy: ${toBuyItems.join(', ') || 'none'}.
High-altitude days (>4000m): ${highAltDays.join(', ') || 'none'}.
Fully offline days (no signal): ${offlineDays.join(', ') || 'none'}.

Identify the top packing gaps or risks. Prioritise safety-critical items (altitude/AMS, cold, medical), offline preparation, and anything missing for high-altitude days. Be specific to what is actually missing — do not flag things already on the list. Return up to 4 gaps, most severe first. Never prescribe medication doses.`
    const { object } = await generateObject({
      model:  getAzureModel(),
      schema: GapSchema,
      prompt,
    })
    return object
  },
  ['ai-gaps'],
  { revalidate: 3600 },
)

const sevStyle: Record<string, { dot: string; label: string; cls: string }> = {
  high:   { dot: 'bg-accent-3', label: 'High',   cls: 'text-accent-3 border-accent-3/30 bg-accent-3/10' },
  medium: { dot: 'bg-accent',   label: 'Medium', cls: 'text-accent   border-accent/30   bg-accent/10'   },
  low:    { dot: 'bg-accent-4', label: 'Low',    cls: 'text-accent-4 border-accent-4/30 bg-accent-4/10' },
}

export default async function AiGapsCard() {
  if (!AI_ENABLED) return null

  try {
    const supabase = await createClient()
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const [{ data: rawItems }, { data: rawItinerary }] = await Promise.all([
      (supabase.from('items') as any).select('name, status').order('sort_order'),
      (supabase.from('itinerary') as any).select('day, altitude_m, network').order('day'),
    ])
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const items = rawItems as Pick<ItemRow, 'name' | 'status'>[] | null
    const itinerary = rawItinerary as Pick<ItineraryRow, 'day' | 'altitude_m' | 'network'>[] | null

    const unpacked   = (items ?? []).map(i => i.name)
    const toBuy      = (items ?? []).filter(i => i.status === 'to_buy').map(i => i.name)
    const highAlt    = itinerary?.filter(l => (l.altitude_m ?? 0) > 4000).map(l => `Day ${l.day}`) ?? []
    const offline    = itinerary?.filter(l => l.network === 'none').map(l => `Day ${l.day}`) ?? []

    const { gaps } = await generateGapsCached(unpacked, toBuy, highAlt, offline)

    if (!gaps?.length) {
      return (
        <section className="bg-surface border border-accent-2/20 rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <span className="text-base">🐂</span>
            <p className="font-body text-sm text-text">No critical gaps — your kit looks trek-ready.</p>
          </div>
        </section>
      )
    }

    return (
      <section className="bg-surface border border-accent/20 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <span className="text-base">🐂</span>
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">Pemba&apos;s risk check</p>
        </div>
        <div className="divide-y divide-border/40">
          {gaps.map((g, i) => {
            const s = sevStyle[g.severity] ?? sevStyle.medium
            return (
              <div key={i} className="px-4 py-3 flex gap-3 items-start">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-body text-sm text-text font-medium">{g.title}</p>
                    <span className={`font-mono text-[9px] uppercase tracking-wider border rounded px-1.5 py-0.5 shrink-0 ${s.cls}`}>
                      {s.label}
                    </span>
                  </div>
                  <p className="font-body text-xs text-text-muted leading-relaxed">{g.detail}</p>
                  {g.suggested_items && g.suggested_items.length > 0 && (
                    <p className="font-mono text-[10px] text-text-dim mt-1.5">
                      Suggests: {g.suggested_items.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="px-4 py-2.5 border-t border-border/40 bg-surface-2/30">
          <a href="/ask" className="font-mono text-xs text-accent hover:underline">
            Ask Pemba to add these →
          </a>
        </div>
      </section>
    )
  } catch {
    return null
  }
}

export function AiGapsCardSkeleton() {
  return (
    <section className="bg-surface border border-border rounded-2xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base opacity-40">🐂</span>
        <div className="h-3 w-28 bg-border rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-border mt-1.5 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-border rounded w-2/3" />
              <div className="h-3 bg-border rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
