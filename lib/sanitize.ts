// Shared input sanitizer for free-text fields that can flow into AI prompts /
// tool results. Collapses control chars + newlines to single spaces, trims,
// and caps length — neutralising prompt-injection vectors in stored names.
export function sanitizeText(s: string, max = 200): string {
  let out = ''
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0
    out += code < 0x20 || code === 0x7f ? ' ' : ch
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, max)
}
