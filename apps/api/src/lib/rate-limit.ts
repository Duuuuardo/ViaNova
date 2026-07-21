import { Elysia } from 'elysia'

interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

function getClientIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip')
  if (cf) return cf
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return 'unknown'
}

function getBucket(key: string, windowMs: number): Bucket {
  const now = Date.now()
  const existing = store.get(key)
  if (existing && existing.resetAt > now) {
    return existing
  }
  const bucket: Bucket = { count: 0, resetAt: now + windowMs }
  store.set(key, bucket)
  return bucket
}

export function createRateLimiter(options: {
  windowMs: number
  maxRequests: number
  keyPrefix?: string
}) {
  return new Elysia({ name: 'rateLimit' }).onBeforeHandle(({ request, set }) => {
    const ip = getClientIp(request)
    const key = `${options.keyPrefix ?? 'rl'}:${ip}`
    const bucket = getBucket(key, options.windowMs)
    bucket.count++
    if (bucket.count > options.maxRequests) {
      set.status = 429
      set.headers['Retry-After'] = String(Math.ceil((bucket.resetAt - Date.now()) / 1000))
      return { message: 'Muitas requisições. Tente novamente mais tarde.' }
    }
  })
}
