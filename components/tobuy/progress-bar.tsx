import type { ProgressStat } from '@/lib/progress'

interface ProgressBarProps {
  stat: ProgressStat
  size?: 'sm' | 'md'
}

export default function ProgressBar({ stat, size = 'md' }: ProgressBarProps) {
  const pct = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0
  const allDone = stat.total > 0 && stat.done === stat.total

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className={`font-mono text-text ${size === 'sm' ? 'text-[11px]' : 'text-xs'} uppercase tracking-wider`}>
          {stat.label}
        </span>
        <span className={`font-mono tabular-nums ${size === 'sm' ? 'text-[11px]' : 'text-xs'} ${allDone ? 'text-accent-2' : 'text-text-muted'}`}>
          {stat.done}/{stat.total}
        </span>
      </div>
      <div className={`w-full bg-border rounded-full overflow-hidden ${size === 'sm' ? 'h-1' : 'h-1.5'}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-accent-2' : stat.color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
