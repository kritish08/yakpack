export default function Loading() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="w-8 h-8 bg-surface rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-surface rounded w-2/3" />
            <div className="h-3 bg-surface rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
