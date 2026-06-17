'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CategoryCard from './category-card'
import type { CategoryWithItems, Packed, Profile } from '@/lib/pack'
import type { Database } from '@/lib/database.types'

type PackedInsert = Database['public']['Tables']['packed']['Insert']

interface PackScreenProps {
  profile: Profile
  categoriesWithItems: CategoryWithItems[]
  initialPacked: Packed[]
}

export default function PackScreen({ profile, categoriesWithItems, initialPacked }: PackScreenProps) {
  const [packed, setPacked] = useState<Packed[]>(initialPacked)
  const supabase = createClient()

  // Realtime subscription — reconcile with server state
  useEffect(() => {
    const channel = supabase
      .channel('packed-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packed' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as Packed
          setPacked(prev => prev.some(p => p.item_id === row.item_id && p.user_key === row.user_key)
            ? prev
            : [...prev, row]
          )
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as Partial<Packed>
          setPacked(prev => prev.filter(p => !(p.item_id === old.item_id && p.user_key === old.user_key)))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const handleToggle = useCallback(async (itemId: string, userKey: string, isPacked: boolean) => {
    // Optimistic update
    if (isPacked) {
      setPacked(prev => prev.filter(p => !(p.item_id === itemId && p.user_key === userKey)))
    } else {
      const optimistic: Packed = { item_id: itemId, user_key: userKey, packed: true, packed_at: new Date().toISOString() }
      setPacked(prev => [...prev, optimistic])
    }

    // DB write
    if (isPacked) {
      await supabase.from('packed').delete().eq('item_id', itemId).eq('user_key', userKey)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('packed') as any).insert({ item_id: itemId, user_key: userKey, packed: true } as PackedInsert)
    }
  }, [supabase])

  const totalItems = categoriesWithItems.reduce((s, c) => s + c.items.length, 0)
  const totalPacked = categoriesWithItems.reduce((s, c) => {
    return s + c.items.filter(item => {
      const key = item.scope === 'each' ? profile.role : 'shared'
      return packed.some(p => p.item_id === item.id && p.user_key === key)
    }).length
  }, 0)
  const pct = totalItems > 0 ? Math.round((totalPacked / totalItems) * 100) : 0

  return (
    <div className="px-4 pt-4 pb-6 flex flex-col gap-3">
      {/* Header + overall progress */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text">Pack</h1>
          <span className="font-mono text-sm text-text-muted">{totalPacked}/{totalItems}</span>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="font-mono text-xs text-text-muted mt-1">{pct}% packed</p>
      </div>

      {/* Category cards */}
      {categoriesWithItems.map(cat => (
        <CategoryCard
          key={cat.id}
          category={cat}
          packed={packed}
          profile={profile}
          onToggle={handleToggle}
        />
      ))}
    </div>
  )
}
