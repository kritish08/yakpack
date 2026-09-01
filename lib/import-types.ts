import type { ItemScope, ItemStatus, NetworkQuality } from '@/lib/database.types'

/** What the geocoder proposes for one place — never applied without a tick. */
export interface Suggestion {
  query: string
  name: string
  country: string | null
  admin: string | null
  lat: number
  lon: number
  elevation: number | null
  nameMatches: boolean
}

/** One day as read out of a PDF, a page, pasted text, or typed by hand. */
export interface ParsedDay {
  day: number
  date: string | null
  leg: string
  place: string | null
  highlights: string | null
  warnings: string | null
  network: NetworkQuality | null
  lat: number | null
  lon: number | null
  altitude_m: number | null
  suggestion: Suggestion | null
}

/** One proposed packing item, from the rules or from Pemba. */
export interface ProposedItem {
  category: string
  name: string
  note?: string
  scope: ItemScope
  status: ItemStatus
  essential?: boolean
  /** Why this trip needs it. Shown in review, not stored. */
  because?: string
}

/** A contact gathered during onboarding, before it becomes a `trip_contacts` row. */
export interface DraftContact {
  role: string
  name: string
  phone: string
}

/** One day as typed by hand in the manual flow. */
export interface DraftDay {
  date: string
  leg: string
  place: string
  altitude: string
}
