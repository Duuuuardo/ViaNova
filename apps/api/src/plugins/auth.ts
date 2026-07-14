import { Elysia } from 'elysia'
import { validateSession, SESSION_COOKIE } from '../lib/session'

export const authPlugin = new Elysia({ name: 'auth' })
  .derive({ as: 'global' }, async ({ cookie }) => {
    const token = cookie[SESSION_COOKIE]?.value as string | undefined
    if (!token) return { session: null }
    const session = await validateSession(token)
    return { session }
  })
