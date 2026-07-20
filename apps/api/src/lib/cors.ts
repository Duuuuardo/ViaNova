/**
 * Configuração de CORS sem fallback inseguro.
 *
 * Em produção, VIANOVA_WEB_URL e/ou VIANOVA_ALLOWED_ORIGINS devem estar
 * configurados. O fallback para localhost só existe em desenvolvimento.
 *
 * VIANOVA_ALLOWED_ORIGINS deve conter os domínios dos produtos que chamam
 * /billing/checkout cross-origin (ex.: https://campaigns.naia.website).
 */

export function parseAllowedOrigins(): string[] {
  const raw = process.env.VIANOVA_ALLOWED_ORIGINS
  if (!raw) return []
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

export function getCorsOrigin():
  | string
  | RegExp
  | ((origin: string) => boolean) {
  if (process.env.NODE_ENV !== 'production') {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
  }

  const webUrl = process.env.VIANOVA_WEB_URL
  const allowed = parseAllowedOrigins()

  if (!webUrl && allowed.length === 0) {
    throw new Error(
      'VIANOVA_WEB_URL or VIANOVA_ALLOWED_ORIGINS must be set in production',
    )
  }

  return (origin: string) => {
    if (!origin) return false
    if (webUrl && origin === webUrl) return true
    if (allowed.includes(origin)) return true
    return false
  }
}
