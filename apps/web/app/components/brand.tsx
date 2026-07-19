// Marca do Vianova: duas vias convergindo num ponto — o "V" da Vianova.
export function ViaMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
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

export function ViaLogo({ dark = false, size = 28 }: { dark?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <ViaMark size={size} />
      <span
        className={`font-display font-bold tracking-tight ${dark ? 'text-white' : 'text-ink-900'}`}
        style={{ fontSize: size * 0.78 }}
      >
        vianova
      </span>
    </span>
  )
}

// Assinatura da casa: a linha de rota. Sinaliza de onde você vem e para onde
// o login te leva (usada no fluxo OIDC vindo de um produto).
export function RouteLine({ destination }: { destination: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono text-ink-500">
      <span className="size-1.5 rounded-full bg-via-600" aria-hidden="true" />
      <span>vianova</span>
      <span className="flex-1 border-t border-dashed border-line-strong" aria-hidden="true" />
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="text-via-600">
        <path d="M1 5h7M5.5 1.8 8.7 5 5.5 8.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-ink-900 font-medium">{destination}</span>
    </div>
  )
}
