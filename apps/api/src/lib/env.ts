export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    console.error(`[bootstrap] Environment variable ${name} is required`)
    process.exit(1)
  }
  return value
}

export function requireEnvInProduction(name: string): string | undefined {
  if (process.env.NODE_ENV !== 'production') return process.env[name]
  return requireEnv(name)
}

export const isProduction = process.env.NODE_ENV === 'production'

export function getCookieOptions() {
  const domain = process.env.VIANOVA_COOKIE_DOMAIN
  return {
    httpOnly: true,
    sameSite: 'none' as const,
    secure: isProduction,
    path: '/',
    ...(domain ? { domain } : {}),
  }
}

export function getCorsOriginHandler(): string | string[] | RegExp | ((request: Request) => boolean) {
  if (!isProduction) {
    const regex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
    return (request: Request) => regex.test(request.headers.get('origin') ?? '')
  }

  const configured = process.env.CORS_ALLOWED_ORIGINS
  if (configured) {
    try {
      const list = JSON.parse(configured) as string[]
      if (!Array.isArray(list) || list.some((o) => typeof o !== 'string')) {
        throw new Error('CORS_ALLOWED_ORIGINS must be a JSON array of strings')
      }
      return list
    } catch {
      console.error('[bootstrap] CORS_ALLOWED_ORIGINS is not a valid JSON array')
      process.exit(1)
    }
  }

  const webUrl = requireEnv('VIANOVA_WEB_URL')
  return [webUrl]
}

let _tokenHashSalt: string | undefined
export function getTokenHashSalt(): string {
  if (!_tokenHashSalt) {
    _tokenHashSalt = requireEnv('TOKEN_HASH_SALT')
  }
  return _tokenHashSalt
}
