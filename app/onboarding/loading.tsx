export default function Loading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-pulse">
      <div className="h-7 w-48 rounded bg-surface-2" />
      <div className="h-4 w-full rounded bg-surface-2 mt-4" />
      <div className="flex flex-col gap-3 mt-5">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-surface" />)}
      </div>
    </div>
  )
}
