import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { api } from './api'

export const getSession = createServerFn().handler(async () => {
  try {
    const sessionToken = getCookie('vianova_session')
    if (!sessionToken) return null
    const { data, error } = await api.auth.me.get({
      headers: { cookie: `vianova_session=${sessionToken}` },
    })
    if (error) return null
    return data?.user ?? null
  } catch {
    return null
  }
})

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>
