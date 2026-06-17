export type PembaMood = 'excited' | 'happy' | 'cautious' | 'cold' | 'rainy' | 'tired' | 'thinking'

const MOODS: Record<PembaMood, { emoji: string; line: string; sub: string; color: string }> = {
  excited: {
    emoji: '🐂',
    line: "Let's go — day's here!",
    sub: 'Pemba is pumped',
    color: 'border-accent/40 bg-accent/5',
  },
  happy: {
    emoji: '🐂',
    line: 'Conditions are looking good.',
    sub: 'Pemba approves',
    color: 'border-accent-2/40 bg-accent-2/5',
  },
  cautious: {
    emoji: '🐂',
    line: 'Heads up — check the warnings.',
    sub: 'Pemba is watchful',
    color: 'border-accent-3/40 bg-accent-3/5',
  },
  cold: {
    emoji: '🐂',
    line: 'Layer up. It will be cold.',
    sub: 'Pemba has seen worse',
    color: 'border-accent-4/40 bg-accent-4/5',
  },
  rainy: {
    emoji: '🐂',
    line: 'Rain cover on the pack.',
    sub: 'Pemba is waterproof',
    color: 'border-accent-4/40 bg-accent-4/5',
  },
  tired: {
    emoji: '🐂',
    line: 'What a journey that was.',
    sub: 'Pemba needs hay',
    color: 'border-border bg-surface',
  },
  thinking: {
    emoji: '🐂',
    line: 'Checking conditions…',
    sub: 'Pemba is thinking',
    color: 'border-border bg-surface',
  },
}

interface PembaProps {
  mood: PembaMood
  className?: string
}

export default function Pemba({ mood, className = '' }: PembaProps) {
  const m = MOODS[mood]

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      {/* Yak */}
      <span className="text-4xl leading-none select-none" role="img" aria-label="Pemba the yak">
        {m.emoji}
      </span>

      {/* Speech bubble */}
      <div className={`relative flex-1 border rounded-2xl rounded-tl-sm px-4 py-3 transition-colors ${m.color}`}>
        <p className="font-body text-sm text-text leading-snug">{m.line}</p>
        <p className="font-mono text-[10px] text-text-muted mt-0.5 uppercase tracking-wider">{m.sub}</p>
      </div>
    </div>
  )
}

/** Derive Pemba's mood from Today screen context */
export function deriveMood({
  isToday,
  isPast,
  activeTags,
  hasWarnings,
}: {
  isToday: boolean
  isPast: boolean
  activeTags: string[]
  hasWarnings: boolean
}): PembaMood {
  if (isPast) return 'tired'
  if (isToday && hasWarnings) return 'cautious'
  if (isToday && activeTags.includes('cold')) return 'cold'
  if (isToday && activeTags.includes('rain')) return 'rainy'
  if (isToday) return 'excited'
  return 'happy'
}
