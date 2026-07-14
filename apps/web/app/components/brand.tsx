// Marca do Vianova: losango (placa de sinalização) + wordmark em Overpass.
export function ViaMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="3.3"
        y="3.3"
        width="9.4"
        height="9.4"
        rx="1.6"
        transform="rotate(45 8 8)"
        className="fill-via-600"
      />
      <path
        d="M5.6 8.2 7.3 9.9l3.1-3.6"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ViaLogo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <ViaMark size={18} />
      <span
        className={`font-display font-bold text-lg leading-none tracking-tight ${dark ? 'text-white' : 'text-ink-900'}`}
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
