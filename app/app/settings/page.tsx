import { createClient } from '@/lib/supabase/server'
import { getTripContext } from '@/lib/trip'
import { getAppRole } from '@/lib/admin'
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

  const [{ memberKey }, appRole] = await Promise.all([getTripContext(), getAppRole()])

  return (
    <SettingsScreen
      profile={profile}
      userEmail={user?.email ?? ''}
      memberKey={memberKey}
      appRole={appRole}
    />
  )
}
