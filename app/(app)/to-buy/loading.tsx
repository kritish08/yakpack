export default function Loading() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      {/* Progress bars */}
      <div className="space-y-2">
        <div className="h-4 bg-surface rounded w-24" />
        <div className="h-2 bg-surface rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-12 bg-surface rounded-lg" />
        <div className="h-12 bg-surface rounded-lg" />
      </div>
      {/* Item rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-5 h-5 bg-surface rounded-full" />
          <div className="flex-1 h-4 bg-surface rounded" />
        </div>
      ))}
    </div>
  )
}
