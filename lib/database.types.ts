/**
 * Hand-maintained mirror of the Postgres schema in supabase/migrations.
 *
 * Person identity is per-trip, not global. `assigned_to` and `packed.user_key`
 * hold a MemberKey (or 'shared'), never a username.
 *
 * Deliberately NOT called 'owner' — that reads as the owner of the application,
 * which is `profiles.app_role = 'admin'` and an unrelated axis.
 */

/** A person's slot within one trip: who created it, plus up to two partners. */
export type MemberKey = 'organiser' | 'partner_1' | 'partner_2'

/** Slots a partner can occupy, in the order they are handed out. */
export const PARTNER_KEYS = ['partner_1', 'partner_2'] as const

/** Most partners a single trip may hold. */
export const MAX_PARTNERS = PARTNER_KEYS.length

/** Who an item belongs to: one member, or both of them. */
export type AssignedTo = MemberKey | 'shared'

/** Which packed row an item uses: per-person, or a single shared row. */
export type ItemScope = 'each' | 'shared'

export type ItemStatus = 'owned' | 'to_buy' | 'standard'

export type NetworkQuality = 'good' | 'weak' | 'none' | 'patchy'

/**
 * Standing in the application, as opposed to identity within a trip.
 * An admin is a normal user who also operates the deployment.
 */
export type AppRole = 'admin' | 'user'

/** One person in the trip, as the UI needs them. */
export interface TripMemberView {
  memberKey: MemberKey
  displayName: string
  isMe: boolean
}

/**
 * Client-safe view of the current trip's people.
 *
 * Lives here rather than in lib/trip.ts so client components can type against it
 * without importing a module that reaches for next/headers. TripContext is
 * structurally assignable to it, so server code just passes the context through.
 *
 * `members` is ordered organiser → partner_1 → partner_2 and holds only slots
 * that are actually filled, so the UI never renders an empty person.
 */
export interface MemberView {
  tripId: string
  memberKey: MemberKey
  myName: string
  members: TripMemberView[]
  isOrganiser: boolean
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          color: string
          app_role: AppRole
          created_at: string
        }
        Insert: {
          id?: string
          display_name: string
          color?: string
          app_role?: AppRole
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          color?: string
          app_role?: AppRole
          created_at?: string
        }
      }
      trips: {
        Row: {
          id: string
          name: string
          depart_date: string | null
          coordinator_name: string | null
          coordinator_phone: string | null
          leader_name: string | null
          leader_phone: string | null
          is_template: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          depart_date?: string | null
          coordinator_name?: string | null
          coordinator_phone?: string | null
          leader_name?: string | null
          leader_phone?: string | null
          is_template?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          depart_date?: string | null
          coordinator_name?: string | null
          coordinator_phone?: string | null
          leader_name?: string | null
          leader_phone?: string | null
          is_template?: boolean
          created_by?: string | null
          created_at?: string
        }
      }
      trip_members: {
        Row: {
          trip_id: string
          user_id: string
          member_key: MemberKey
          display_name: string | null
          created_at: string
        }
        Insert: {
          trip_id: string
          user_id: string
          member_key: MemberKey
          display_name?: string | null
          created_at?: string
        }
        Update: {
          trip_id?: string
          user_id?: string
          member_key?: MemberKey
          display_name?: string | null
          created_at?: string
        }
      }
      trip_invites: {
        Row: {
          id: string
          trip_id: string
          member_key: 'partner_1' | 'partner_2'
          email: string | null
          token: string
          status: 'pending' | 'accepted' | 'revoked'
          invited_by: string | null
          created_at: string
          expires_at: string
          accepted_at: string | null
          accepted_by: string | null
        }
        Insert: {
          id?: string
          trip_id: string
          member_key: 'partner_1' | 'partner_2'
          email?: string | null
          token?: string
          status?: 'pending' | 'accepted' | 'revoked'
          invited_by?: string | null
          created_at?: string
          expires_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
        }
        Update: {
          status?: 'pending' | 'accepted' | 'revoked'
          email?: string | null
          expires_at?: string
        }
      }
      categories: {
        Row: {
          id: number
          trip_id: string
          name: string
          icon: string | null
          sort_order: number
        }
        Insert: {
          id?: number
          trip_id: string
          name: string
          icon?: string | null
          sort_order: number
        }
        Update: {
          id?: number
          trip_id?: string
          name?: string
          icon?: string | null
          sort_order?: number
        }
      }
      items: {
        Row: {
          id: string
          trip_id: string
          category_id: number
          name: string
          note: string | null
          qty: string | null
          status: ItemStatus
          assigned_to: AssignedTo
          scope: ItemScope
          carry_tags: string[]
          sort_order: number
          is_custom: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          category_id: number
          name: string
          note?: string | null
          qty?: string | null
          status?: ItemStatus
          assigned_to?: AssignedTo
          scope?: ItemScope
          carry_tags?: string[]
          sort_order?: number
          is_custom?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          category_id?: number
          name?: string
          note?: string | null
          qty?: string | null
          status?: ItemStatus
          assigned_to?: AssignedTo
          scope?: ItemScope
          carry_tags?: string[]
          sort_order?: number
          is_custom?: boolean
          created_by?: string | null
          created_at?: string
        }
      }
      packed: {
        Row: {
          item_id: string
          user_key: AssignedTo
          packed: boolean
          packed_at: string | null
        }
        Insert: {
          item_id: string
          user_key: AssignedTo
          packed?: boolean
          packed_at?: string | null
        }
        Update: {
          item_id?: string
          user_key?: AssignedTo
          packed?: boolean
          packed_at?: string | null
        }
      }
      itinerary: {
        Row: {
          trip_id: string
          day: number
          date: string | null
          leg: string
          lat: number
          lon: number
          altitude_m: number | null
          highlights: string | null
          carry_today: string[]
          prep_tonight: string | null
          warnings: string | null
          network: NetworkQuality | null
          fun: string | null
          tip: string | null
        }
        Insert: {
          trip_id: string
          day: number
          date?: string | null
          leg: string
          lat: number
          lon: number
          altitude_m?: number | null
          highlights?: string | null
          carry_today?: string[]
          prep_tonight?: string | null
          warnings?: string | null
          network?: NetworkQuality | null
          fun?: string | null
          tip?: string | null
        }
        Update: {
          trip_id?: string
          day?: number
          date?: string | null
          leg?: string
          lat?: number
          lon?: number
          altitude_m?: number | null
          highlights?: string | null
          carry_today?: string[]
          prep_tonight?: string | null
          warnings?: string | null
          network?: NetworkQuality | null
          fun?: string | null
          tip?: string | null
        }
      }
    }
  }
}

// Convenience type aliases for extracting Row, Insert, Update types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
