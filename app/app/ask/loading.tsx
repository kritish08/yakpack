export default function Loading() {
  return (
    <div className="h-full flex flex-col px-4 py-5 gap-3 animate-pulse">
      <div className="h-6 w-24 rounded bg-surface-2" />
      <div className="h-16 rounded-2xl bg-surface" />
      <div className="h-12 w-3/4 rounded-2xl bg-surface self-end" />
      <div className="h-20 rounded-2xl bg-surface" />
      <div className="mt-auto h-12 rounded-xl bg-surface-2" />
    </div>
  )
}
