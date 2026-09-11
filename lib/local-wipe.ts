import { clearQueue } from '@/lib/offline-queue'
import { clearKey } from '@/lib/byok'

/**
 * Everything this browser is holding on behalf of the signed-in user.
 *
 * Signing out cleared the Supabase session and nothing else, which on a shared
 * or borrowed phone is the wrong half of the job. The service worker caches
 * Supabase row reads in `<version>-data` and rendered screens in
 * `<version>-pages`, so the next person to use the browser could go offline and
 * be served the previous user's pages straight out of the cache. The outbox is
 * a single origin-wide localStorage key, so their un-replayed check-offs would
 * still be sitting there too, and the BYOK OpenAI key is a credential that has
 * no business outliving the session that set it.
 *
 * Cross-account *writes* were never the exposure: RLS pins a `packed` row to
 * the caller's own slot, so replaying one under a different session is refused
 * by Postgres. This is about what stays readable at rest.
 *
 * Static assets are deliberately kept. They are content-hashed, identical for
 * every user, and re-downloading the whole bundle on each sign-out costs real
 * bandwidth for no privacy gained.
 */
const USER_SCOPED_CACHE = /-(pages|data|weather)$/

/** Deletes the caches that hold one user's content. Never throws. */
async function purgeUserCaches(): Promise<void> {
  try {
    if (typeof caches === 'undefined') return
    const names = await caches.keys()
    await Promise.all(
      names.filter(n => USER_SCOPED_CACHE.test(n)).map(n => caches.delete(n)),
    )
  } catch {
    // Cache Storage is unavailable in a private window and in some embedded
    // browsers. Failing to purge must not block signing out.
  }
}

/**
 * Call before tearing down the session, so nothing that identifies the user is
 * left on the device. Resolves even when parts of it fail.
 */
export async function wipeLocalData(): Promise<void> {
  try { clearQueue() } catch { /* ignore */ }
  try { clearKey() } catch { /* ignore */ }
  await purgeUserCaches()
}
