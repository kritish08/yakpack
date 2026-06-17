export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* Overall progress bar */}
      <div className="px-4 py-3 border-b border-border">
        <div className="h-2 bg-surface rounded-full w-full" />
      </div>
      {/* Category cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border-b border-border">
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="w-8 h-8 bg-surface rounded-lg" />
            <div className="flex-1 h-4 bg-surface rounded" />
            <div className="w-16 h-4 bg-surface rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
