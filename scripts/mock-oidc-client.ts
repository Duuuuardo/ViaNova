
import { createRemoteJWKSet, jwtVerify } from 'jose'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`[mock-oidc-client] ${name} is required`)
  }
  return value
}

const VIANOVA_API = requireEnv('VIANOVA_API_URL')
const CLIENT_ID = 'naia'
const CLIENT_SECRET = requireEnv('NAIA_OIDC_CLIENT_SECRET')
const PORT = 9999
const REDIRECT_URI = `http://localhost:${PORT}/callback`

const jwks = createRemoteJWKSet(new URL(`${VIANOVA_API}/.well-known/jwks.json`))

function page(body: string): Response {
  return new Response(
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Produto de teste</title>
    <style>body{font-family:monospace;max-width:720px;margin:48px auto;padding:0 16px;line-height:1.6}
    a{color:#3d4fef}pre{background:#f4f4f4;padding:16px;border-radius:8px;overflow:auto}</style>
    </head><body>${body}</body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  )
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    if (url.pathname === '/') {
      const authorizeUrl = new URL(`${VIANOVA_API}/oidc/authorize`)
      authorizeUrl.searchParams.set('client_id', CLIENT_ID)
      authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI)
      authorizeUrl.searchParams.set('response_type', 'code')
      authorizeUrl.searchParams.set('state', crypto.randomUUID())

      return page(`
        <h1>Produto de teste (mock OIDC client)</h1>
        <p>Simula o Naia autenticando contra o Vianova.</p>
        <p><a href="${authorizeUrl}">→ Entrar com Vianova</a></p>
      `)
    }

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code')
      if (!code) return page('<p>Erro: nenhum código recebido.</p>')

      const tokenRes = await fetch(`${VIANOVA_API}/oidc/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
        }),
      })

      const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string }
      if (!tokenData.access_token) {
        return page(`<p>Erro na troca do código:</p><pre>${JSON.stringify(tokenData, null, 2)}</pre>`)
      }

      try {
        const { payload, protectedHeader } = await jwtVerify(tokenData.access_token, jwks, {
          issuer: VIANOVA_API,
          audience: CLIENT_ID,
        })

        return page(`
          <h1>✓ Login federado funcionando</h1>
          <p>JWT assinado pelo Vianova, verificado localmente via JWKS.</p>
          <h3>Header</h3><pre>${JSON.stringify(protectedHeader, null, 2)}</pre>
          <h3>Claims</h3><pre>${JSON.stringify(payload, null, 2)}</pre>
          <p><a href="/introspect?token=${encodeURIComponent(tokenData.access_token)}">→ Testar introspection (single sign-out)</a></p>
        `)
      } catch (err) {
        return page(`<p>JWT inválido: ${String(err)}</p>`)
      }
    }

    if (url.pathname === '/introspect') {
      const token = url.searchParams.get('token')
      if (!token) return page('<p>Erro: token ausente.</p>')

      const res = await fetch(`${VIANOVA_API}/oidc/introspect`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
      })
      const data = await res.json()

      return page(`
        <h1>Introspection</h1>
        <pre>${JSON.stringify(data, null, 2)}</pre>
        <p>Deslogue do Vianova e recarregue esta página: <code>active</code> deve virar <code>false</code> na hora.</p>
      `)
    }

    return new Response('Not found', { status: 404 })
  },
})

console.log(`Mock OIDC client rodando em http://localhost:${PORT}`)
