interface HeadsUpProps {
  warnings: string | null
}

export default function HeadsUp({ warnings }: HeadsUpProps) {
  if (!warnings) return null
  return (
    <div className="bg-accent-3/10 border border-accent-3/30 rounded-2xl p-4">
      <p className="font-mono text-xs text-accent-3 uppercase tracking-wider mb-1.5">⚠ Heads up</p>
      <p className="font-body text-sm text-text leading-relaxed">{warnings}</p>
    </div>
  )
}
