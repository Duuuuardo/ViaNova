export function VianovaMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      {/* duas vias convergindo num ponto — o "V" da Vianova */}
      <path
        d="M5 6 L16 26 L27 6"
        stroke="url(#via-grad)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="26" r="3.5" fill="#C466FF" />
      <defs>
        <linearGradient id="via-grad" x1="5" y1="6" x2="27" y2="26">
          <stop offset="0%" stopColor="#D08BFF" />
          <stop offset="100%" stopColor="#8A2CC4" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function VianovaLogo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <VianovaMark size={size} />
      <span
        className="font-display font-bold tracking-tight text-ink-900"
        style={{ fontSize: size * 0.78 }}
      >
        vianova
      </span>
    </span>
  )
}
