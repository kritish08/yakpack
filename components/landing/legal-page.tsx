import type { ReactNode } from 'react'

/** Shared shell for /terms and /privacy so both read as one document set. */
export default function LegalPage({
  eyebrow, title, updated, children,
}: { eyebrow: string; title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-5 sm:px-8 pt-32 pb-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">{eyebrow}</p>
      <h1 className="font-display font-extrabold uppercase tracking-[-0.03em] text-text mt-3 leading-[0.95] text-[clamp(2rem,6vw,3.5rem)]">
        {title}
      </h1>
      <p className="font-mono text-[11px] text-text-dim mt-4">Last updated {updated}</p>

      <div
        className="mt-10 flex flex-col gap-8
          [&_h2]:font-display [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-[-0.02em]
          [&_h2]:text-text [&_h2]:text-lg [&_h2]:mb-3
          [&_p]:font-body [&_p]:text-text-muted [&_p]:leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0
          [&_li]:font-body [&_li]:text-text-muted [&_li]:leading-relaxed [&_li]:mb-2
          [&_ul]:list-disc [&_ul]:pl-5
          [&_strong]:text-text [&_strong]:font-medium
          [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-accent"
      >
        {children}
      </div>
    </article>
  )
}
