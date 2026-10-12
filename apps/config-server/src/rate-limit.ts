import { Elysia } from 'elysia'

export interface RateLimitOptions {
  windowMs?: number
  max?: number
  keyPrefix?: string
}

interface Window {
  count: number
  resetAt: number
}

const store = new Map<string, Window>()

function cleanupExpired(now: number) {
  for (const [key, window] of store.entries()) {
    if (window.resetAt < now) store.delete(key)
  }
}

export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60_000
  const max = options.max ?? 100
  const keyPrefix = options.keyPrefix ?? 'rl'

  return new Elysia({ name: 'rate-limit', seed: options }).onBeforeHandle(
    { as: 'global' },
    async ({ request, set }) => {
      const forwarded = request.headers.get('x-forwarded-for')
      const ip = forwarded?.split(',')[0]?.trim() ?? 'unknown'
      const route = new URL(request.url).pathname
      const key = `${keyPrefix}:${ip}:${route}`
      const now = Date.now()

      if (store.size > 10_000) cleanupExpired(now)

      const current = store.get(key)
      if (!current || current.resetAt < now) {
        store.set(key, { count: 1, resetAt: now + windowMs })
        return
      }

      current.count++
      if (current.count > max) {
        set.status = 429
        set.headers['retry-after'] = String(Math.ceil((current.resetAt - now) / 1000))
        return { message: 'Muitas requisições. Tente novamente mais tarde.' }
      }
    },
  )
}
