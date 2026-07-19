import { Elysia } from 'elysia'
import { validateSession, validateJwtSession, SESSION_COOKIE } from '../lib/session'

export const authPlugin = new Elysia({ name: 'auth' })
  .derive({ as: 'global' }, async ({ cookie, headers }) => {
    const cookieToken = cookie[SESSION_COOKIE]?.value as string | undefined
    if (cookieToken) {
      const session = await validateSession(cookieToken)
      if (session) return { session }
    }

    const authHeader = headers.authorization
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    if (bearerToken) {
      const session = await validateJwtSession(bearerToken)
      if (session) return { session }
    }

    return { session: null }
  })
