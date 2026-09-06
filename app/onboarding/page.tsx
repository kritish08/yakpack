import { AI_ENABLED } from '@/lib/ai'
import { safeNext } from '@/lib/safe-next'
import { listTrips } from '@/lib/trip'
import NewTripFlow from '@/components/onboarding/new-trip-flow'

export const metadata = { title: 'New trip — YakPack' }

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; next?: string }>
}) {
  // Carried from the register form, so a name typed at signup is not asked for
  // twice.
  const { name, next } = await searchParams
  // "First trip" only changes the heading, so a failure to count is not worth
  // failing the page over.
  const trips = await listTrips().catch(() => [])

  return <NewTripFlow aiEnabled={AI_ENABLED} isFirstTrip={trips.length === 0} initialName={name ?? ''} nextPath={safeNext(next)} />
}
