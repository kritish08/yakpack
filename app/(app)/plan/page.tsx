import { getPlanData } from '@/lib/plan'
import PlanScreen from '@/components/plan/plan-screen'

export default async function PlanPage() {
  const data = await getPlanData()
  return <PlanScreen {...data} />
}
