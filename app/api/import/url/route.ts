import { getTripContext } from '@/lib/trip'
import { safeFetchPage, UnsafeUrlError } from '@/lib/safe-fetch'
import { htmlToText, htmlTitle } from '@/lib/html-text'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Reads a public itinerary page and hands back its text.
 *
 * Note what this route does *not* do: it never calls the AI. Fetching is the
 * part that needs a server (CORS forbids the browser from reading another
 * origin, and the SSRF guard has to run somewhere trusted); structuring the
 * text is the part that needs the caller's own OpenAI key, which the server
 * cannot see. So the client takes this text and posts it to
 * /api/ai/import-itinerary itself. Two small routes, one trust boundary each.
 */
export async function POST(req: Request) {
  try {
    await getTripContext()
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let url: unknown
  try {
    ({ url } = await req.json())
  } catch {
    return Response.json({ error: 'Bad request.' }, { status: 400 })
  }
  if (typeof url !== 'string' || url.trim().length === 0) {
    return Response.json({ error: 'Paste a link first.' }, { status: 400 })
  }

  try {
    const page = await safeFetchPage(url.trim())
    const text = htmlToText(page.body)

    if (text.length < 200) {
      return Response.json({
        error: 'There was almost no text on that page — it may need JavaScript to load. Copy the itinerary and paste it instead.',
      }, { status: 422 })
    }

    return Response.json({
      url: page.url,
      title: htmlTitle(page.body),
      text: text.slice(0, 40_000),
      truncated: page.truncated || text.length > 40_000,
    })
  } catch (e) {
    // UnsafeUrlError messages are written to be safe to show; anything else is
    // reported generically so this route cannot be used to probe the network.
    if (e instanceof UnsafeUrlError) {
      return Response.json({ error: e.message }, { status: 422 })
    }
    return Response.json({ error: 'That page could not be read.' }, { status: 502 })
  }
}
