import { getPackData } from '@/lib/pack'
import PackScreen from '@/components/pack/pack-screen'

export default async function PackPage() {
  const { ctx, categoriesWithItems, packed } = await getPackData()
  return (
    <PackScreen
      ctx={ctx}
      categoriesWithItems={categoriesWithItems}
      initialPacked={packed}
    />
  )
}
