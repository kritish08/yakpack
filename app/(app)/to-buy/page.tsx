import { getToBuyData } from '@/lib/tobuy'
import ToBuyScreen from '@/components/tobuy/to-buy-screen'

export default async function ToBuyPage() {
  const data = await getToBuyData()
  return <ToBuyScreen {...data} />
}
