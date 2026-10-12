export type AvatarFrame = 'none' | 'via' | 'gradient'

const sizes = {
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-16 text-xl',
} as const

const frames: Record<AvatarFrame, string> = {
  none: 'p-0 bg-transparent',
  via: 'p-[2.5px] bg-via-500',
  gradient: 'p-[2.5px] bg-[conic-gradient(from_140deg,#c466ff,#8a2cc4,#d08bff,#c466ff)]',
}

export function Avatar({
  name,
  avatarUrl,
  frame = 'none',
  size = 'md',
}: {
  name: string
  avatarUrl?: string | null
  frame?: AvatarFrame | string | null
  size?: keyof typeof sizes
}) {
  const frameClass = frames[(frame ?? 'none') as AvatarFrame] ?? frames.none
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()

  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-full ${frameClass}`}>
      <span
        className={`relative inline-grid place-items-center overflow-hidden rounded-full border-2 border-surface bg-via-100 font-display font-bold text-via-700 ${sizes[size]}`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          initials || '?'
        )}
      </span>
    </span>
  )
}
