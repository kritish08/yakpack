export default function Loading() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      {/* Weather hero block */}
      <div className="h-40 bg-surface rounded-xl" />
      {/* Carry chips row */}
      <div className="flex gap-2">
        <div className="h-7 w-20 bg-surface rounded-full" />
        <div className="h-7 w-16 bg-surface rounded-full" />
        <div className="h-7 w-24 bg-surface rounded-full" />
      </div>
      {/* Leg card */}
      <div className="h-28 bg-surface rounded-xl" />
      {/* Pemba block */}
      <div className="h-16 bg-surface rounded-xl" />
    </div>
  )
}
