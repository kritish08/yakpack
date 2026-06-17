import { getPackData } from '@/lib/pack'
import PackScreen from '@/components/pack/pack-screen'

export default async function PackPage() {
  const { profile, categoriesWithItems, packed } = await getPackData()
  return (
    <PackScreen
      profile={profile}
      categoriesWithItems={categoriesWithItems}
      initialPacked={packed}
    />
  )
}
