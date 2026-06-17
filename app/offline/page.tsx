export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-6xl" aria-label="Pemba the yak">🐂</span>
      <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text">
        No signal
      </h1>
      <p className="font-body text-sm text-text-muted max-w-xs">
        Pemba can&apos;t reach the mountains right now. Check your connection and try again.
      </p>
      <p className="font-mono text-xs text-text-dim">
        Your pack list was cached — try navigating to /pack.
      </p>
    </div>
  )
}
