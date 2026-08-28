import { AI_ENABLED } from '@/lib/ai'
import { getToBuyData } from '@/lib/tobuy'
import ToBuyScreen from '@/components/tobuy/to-buy-screen'
import AiGapsCard from '@/components/tobuy/ai-gaps-card'

export default async function ToBuyPage() {
  const data = await getToBuyData()

  const gapsNode = AI_ENABLED ? <AiGapsCard /> : null

  return <ToBuyScreen {...data} aiEnabled={AI_ENABLED} gapsNode={gapsNode} />
}
