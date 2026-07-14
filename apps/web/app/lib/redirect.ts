import { API_URL } from './api'

// O único redirect externo aceito após login é a volta pro fluxo OIDC — a URL
// de /oidc/authorize da nossa própria API. Qualquer outra coisa é ignorada.
export function safeOidcRedirect(redirectUri: string | undefined): string | null {
  if (!redirectUri) return null
  try {
    const url = new URL(redirectUri)
    const api = new URL(API_URL)
    if (url.origin === api.origin && url.pathname === '/oidc/authorize') {
      return url.toString()
    }
  } catch {
    // URL inválida — ignora
  }
  return null
}

export function productSlugFromRedirect(redirectUri: string | undefined): string | null {
  const safe = safeOidcRedirect(redirectUri)
  if (!safe) return null
  return new URL(safe).searchParams.get('client_id')
}
