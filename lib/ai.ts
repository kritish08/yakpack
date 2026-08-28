import { createOpenAI } from '@ai-sdk/openai'

export const AI_ENABLED = process.env.AI_ENABLED === 'true'

// Overridable via OPENAI_MODEL — see getModel() below.
const DEFAULT_MODEL = 'gpt-5.6-luna'

export const PEMBA_SYSTEM = `\
You are Pemba, the YakPack AI companion — a wise, warm yak helping Kritish and Gitansh navigate their Spiti Valley expedition (June 19–27, 2026).

You have tools to check their itinerary, live weather, and packing state. Use them proactively to give relevant, grounded answers.

STYLE: Concise — they are on mobile in remote areas with patchy signal. Short paragraphs. No bullet walls. Yak puns welcome but don't overdo it.

PACKING: When you spot a gap or want to suggest items, use addItems. Always describe what you're adding first — the user will confirm before anything is saved.

MEDICAL SAFETY: You may discuss altitude acclimatisation, AMS symptoms, rest days, hydration, and general wellness. You must NEVER prescribe specific medication doses. For any question about Diamox (acetazolamide) dosage or any prescription medication, always say "ask your doctor about the right dose for you." You can mention that Diamox is commonly prescribed for AMS prevention, but the dose decision belongs to a doctor — not you.

Keep responses under 120 words unless the user explicitly asks for more detail.`

/**
 * Resolves which OpenAI key pays for this request.
 *
 * Order matters, and the fallback is deliberately narrow:
 *   1. The caller's own key, arriving as a per-request header (BYOK). Used for
 *      that one request and never persisted.
 *   2. The deployment's server key — **only for an admin**. Without that guard,
 *      any stranger who registered would be spending the operator's credits,
 *      which is the exact thing BYOK exists to prevent.
 *
 * Returns null when neither applies; callers answer 402 rather than crashing.
 */
export function resolveKey(req: Request, callerIsAdmin: boolean): string | null {
  const byok = req.headers.get('x-openai-key')?.trim()
  if (byok) return byok
  if (callerIsAdmin) return process.env.OPENAI_API_KEY?.trim() || null
  return null
}

/**
 * Builds the model client for a resolved key.
 *
 * Model id and API surface stay env-driven so swapping models is a dashboard
 * change rather than a deploy; a BYOK caller may override the model per request.
 */
export function getModel(key: string, modelId?: string | null) {
  const model = modelId?.trim() || process.env.OPENAI_MODEL || DEFAULT_MODEL
  const useResponses = process.env.OPENAI_USE_RESPONSES !== 'false'
  const baseURL = process.env.OPENAI_BASE_URL

  const client = createOpenAI({
    apiKey: key,
    ...(baseURL ? { baseURL } : {}),
  })

  return useResponses ? client.responses(model) : client(model)
}

/** Convenience: resolve the key and build the model, or null if there is no key. */
export function modelForRequest(req: Request, callerIsAdmin: boolean) {
  const key = resolveKey(req, callerIsAdmin)
  if (!key) return null
  return getModel(key, req.headers.get('x-openai-model'))
}
