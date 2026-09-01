/**
 * PDF → text, in the browser.
 *
 * Extraction runs client-side on purpose, for three reasons that all point the
 * same way:
 *
 *   1. A serverless function on Vercel takes a 4.5 MB request body. A 20 MB
 *      operator brochure cannot be uploaded to one at all, so any server-side
 *      design needs blob storage and a second round trip before it can start.
 *   2. The PDF is a booking confirmation. It carries names, phone numbers, seat
 *      and room allocations, sometimes a payment reference. Only the text the
 *      user then chooses to import ever leaves the device — the file itself
 *      never does, and there is nothing to delete afterwards.
 *   3. It costs the server nothing. Parsing a 20 MB PDF is the most expensive
 *      thing in this flow, and it happens on the one machine that already has
 *      the file open.
 *
 * `unpdf` is a pdf.js build with no worker, canvas or DOM dependency, so it runs
 * the same way here and in Node — which is what makes it testable.
 *
 * It also needs no CSP concession. Text extraction calls neither `eval`, `new
 * Function` nor `WebAssembly` — verified by trapping all three around a real
 * extraction — so `script-src 'self' 'unsafe-inline'` in next.config.ts is
 * enough and must not be loosened for this. (pdf.js does reach for WASM when
 * decoding JBIG2/JPEG2000 images; extracting text never decodes an image.)
 */

import { normaliseExtracted } from '@/lib/text-normalise'

export const MAX_PDF_BYTES = 20 * 1024 * 1024

export class PdfError extends Error {}

export interface PdfText {
  text: string
  pages: number
  /** True when the file parsed but held almost no text — i.e. it is a scan. */
  looksScanned: boolean
}

/**
 * Characters per page below which a PDF is treated as images rather than text.
 *
 * A scanned brochure yields a handful of stray characters per page from stamps
 * and page furniture; a real itinerary page yields hundreds. Calling it early
 * matters because the alternative is sending near-empty text to the model,
 * paying for it, and getting a confidently invented itinerary back.
 */
const MIN_CHARS_PER_PAGE = 60

export async function extractPdfText(file: File): Promise<PdfText> {
  if (file.size === 0) throw new PdfError('That file is empty.')
  if (file.size > MAX_PDF_BYTES) {
    throw new PdfError(`That PDF is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 20 MB.`)
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  // Check the magic number rather than the name or the browser's declared type:
  // both are supplied by whoever made the file.
  const header = new TextDecoder('latin1').decode(bytes.subarray(0, 5))
  if (header !== '%PDF-') throw new PdfError('That file is not a PDF.')

  // Imported lazily so the parser — the largest dependency in the app — is
  // fetched only by someone who actually picks a file, and never on first load.
  const { getDocumentProxy, extractText } = await import('unpdf')

  let text: string
  let pages: number
  try {
    const doc = await getDocumentProxy(bytes)
    const result = await extractText(doc, { mergePages: true })
    pages = result.totalPages
    text = (Array.isArray(result.text) ? result.text.join('\n') : result.text) ?? ''
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (/password|encrypt/i.test(msg)) {
      throw new PdfError('That PDF is password-protected. Open it, remove the password, and try again.')
    }
    throw new PdfError('That PDF could not be read. Copy the itinerary and paste it instead.')
  }

  const cleaned = normaliseExtracted(text)
  return {
    text: cleaned,
    pages,
    looksScanned: pages > 0 && cleaned.length < pages * MIN_CHARS_PER_PAGE,
  }
}
