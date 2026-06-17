import { createClient } from '@/lib/supabase/server'
import SettingsScreen from '@/components/settings/settings-screen'

export const metadata = { title: 'Settings — YakPack' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .single()

  return <SettingsScreen profile={profile} userEmail={user?.email ?? ''} />
}
