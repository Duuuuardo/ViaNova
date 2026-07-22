import { createServerFn } from '@tanstack/react-start'
import { deleteCookie, getCookie } from '@tanstack/react-start/server'
import { requireEnv } from './env'

const SESSION_COOKIE = 'vianova_session'

export const endGlobalSession = createServerFn()
  .validator((data: { postLogoutRedirectUri?: string }) => data)
  .handler(async ({ data }) => {
    const publicApiUrl = requireEnv('VIANOVA_API_URL')
    const apiUrl = process.env.VIANOVA_API_INTERNAL_URL || publicApiUrl
    const endpoint = new URL(`${apiUrl}/oidc/end_session`)
    if (data.postLogoutRedirectUri) {
      endpoint.searchParams.set('post_logout_redirect_uri', data.postLogoutRedirectUri)
    }

    const sessionToken = getCookie(SESSION_COOKIE)
    try {
      const response = await fetch(endpoint, {
        headers: sessionToken ? { cookie: `${SESSION_COOKIE}=${sessionToken}` } : undefined,
        redirect: 'manual',
        signal: AbortSignal.timeout(3_000),
      })
      const location = response.headers.get('location')
      if (!location) throw new Error(`end_session respondeu ${response.status} sem Location`)

      const cookieDomain = process.env.VIANOVA_COOKIE_DOMAIN
      deleteCookie(SESSION_COOKIE, {
        path: '/',
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      })

      return location
    } catch {
      // Fallback seguro: se o proxy server-side falhar, o navegador acessa o
      // endpoint público diretamente para não deixar a sessão global ativa.
      const fallback = new URL(`${publicApiUrl}/oidc/end_session`)
      if (data.postLogoutRedirectUri) {
        fallback.searchParams.set('post_logout_redirect_uri', data.postLogoutRedirectUri)
      }
      return fallback.toString()
    }
  })
