export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          role: 'kritish' | 'partner'
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          display_name: string
          role: 'kritish' | 'partner'
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          role?: 'kritish' | 'partner'
          color?: string
          created_at?: string
        }
      }
      categories: {
        Row: {
          id: number
          name: string
          icon: string | null
          sort_order: number
        }
        Insert: {
          id?: number
          name: string
          icon?: string | null
          sort_order: number
        }
        Update: {
          id?: number
          name?: string
          icon?: string | null
          sort_order?: number
        }
      }
      items: {
        Row: {
          id: string
          category_id: number
          name: string
          note: string | null
          qty: string | null
          status: 'owned' | 'to_buy' | 'standard'
          assigned_to: 'kritish' | 'partner' | 'shared'
          scope: 'each' | 'shared'
          carry_tags: string[]
          sort_order: number
          is_custom: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          category_id: number
          name: string
          note?: string | null
          qty?: string | null
          status?: 'owned' | 'to_buy' | 'standard'
          assigned_to?: 'kritish' | 'partner' | 'shared'
          scope?: 'each' | 'shared'
          carry_tags?: string[]
          sort_order?: number
          is_custom?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          category_id?: number
          name?: string
          note?: string | null
          qty?: string | null
          status?: 'owned' | 'to_buy' | 'standard'
          assigned_to?: 'kritish' | 'partner' | 'shared'
          scope?: 'each' | 'shared'
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
          user_key: string
          packed: boolean
          packed_at: string | null
        }
        Insert: {
          item_id: string
          user_key: string
          packed?: boolean
          packed_at?: string | null
        }
        Update: {
          item_id?: string
          user_key?: string
          packed?: boolean
          packed_at?: string | null
        }
      }
      itinerary: {
        Row: {
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
          network: 'good' | 'weak' | 'none' | 'patchy' | null
          fun: string | null
          tip: string | null
        }
        Insert: {
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
          network?: 'good' | 'weak' | 'none' | 'patchy' | null
          fun?: string | null
          tip?: string | null
        }
        Update: {
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
          network?: 'good' | 'weak' | 'none' | 'patchy' | null
          fun?: string | null
          tip?: string | null
        }
      }
      trip: {
        Row: {
          id: number
          name: string | null
          depart_date: string | null
          coordinator_name: string | null
          coordinator_phone: string | null
          leader_name: string | null
          leader_phone: string | null
        }
        Insert: {
          id?: number
          name?: string | null
          depart_date?: string | null
          coordinator_name?: string | null
          coordinator_phone?: string | null
          leader_name?: string | null
          leader_phone?: string | null
        }
        Update: {
          id?: number
          name?: string | null
          depart_date?: string | null
          coordinator_name?: string | null
          coordinator_phone?: string | null
          leader_name?: string | null
          leader_phone?: string | null
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
