import { Elysia, t } from 'elysia'
import { db, productCatalog, oidcAuthCodes, users, sessions } from '@vianova/db'
import { eq, and, gt, isNull } from 'drizzle-orm'
import { getJwks, signUserToken, introspectToken } from '@vianova/oidc'
import { generateId, generateToken, hashToken } from '../lib/crypto'
import { authPlugin } from '../plugins/auth'

const AUTH_CODE_TTL_MS = 60 * 1000 // uso único, vida curta

const WEB_URL = process.env.VIANOVA_WEB_URL ?? 'http://localhost:3000'

async function getActiveClient(clientId: string) {
  const [client] = await db
    .select()
    .from(productCatalog)
    .where(and(eq(productCatalog.slug, clientId), eq(productCatalog.isActive, true)))
    .limit(1)
  return client ?? null
}

function verifyClientSecret(client: { oidcClientSecretHash: string }, secret: string): boolean {
  return hashToken(secret) === client.oidcClientSecretHash
}

export const oidcRoutes = new Elysia()
  .use(authPlugin)

  // Início do Authorization Code flow. Navegação de browser: com sessão ativa
  // emite o código e volta pro produto; sem sessão, manda pro login do Vianova
  // com o retorno apontando de volta pra cá.
  .get(
    '/oidc/authorize',
    async ({ query, session, set, redirect, request }) => {
      const { client_id, redirect_uri, state, scope, nonce } = query

      const client = await getActiveClient(client_id)
      if (!client) {
        set.status = 400
        return { message: 'client_id desconhecido.' }
      }

      // redirect_uri inválido nunca recebe redirect — evita open redirect.
      if (!client.redirectUris.includes(redirect_uri)) {
        set.status = 400
        return { message: 'redirect_uri não registrado para este produto.' }
      }

      if (query.response_type && query.response_type !== 'code') {
        set.status = 400
        return { message: 'Apenas response_type=code é suportado.' }
      }

      if (!session) {
        const loginUrl = new URL(`${WEB_URL}/login`)
        loginUrl.searchParams.set('redirect_uri', request.url)
        return redirect(loginUrl.toString(), 302)
      }

      const code = generateToken()
      await db.insert(oidcAuthCodes).values({
        id: generateId(),
        codeHash: hashToken(code),
        userId: session.userId,
        sessionId: session.sessionId,
        clientSlug: client.slug,
        redirectUri: redirect_uri,
        scope: scope ?? 'openid',
        nonce: nonce ?? null,
        expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
      })

      const target = new URL(redirect_uri)
      target.searchParams.set('code', code)
      if (state) target.searchParams.set('state', state)

      return redirect(target.toString(), 302)
    },
    {
      query: t.Object({
        client_id: t.String(),
        redirect_uri: t.String(),
        response_type: t.Optional(t.String()),
        state: t.Optional(t.String()),
        scope: t.Optional(t.String()),
        nonce: t.Optional(t.String()),
      }),
    },
  )

  // Troca código por JWT assinado. Chamada server-to-server do produto,
  // autenticada por client_secret.
  .post(
    '/oidc/token',
    async ({ body, set }) => {
      if (body.grant_type !== 'authorization_code') {
        set.status = 400
        return { error: 'unsupported_grant_type' as const }
      }

      const client = await getActiveClient(body.client_id)
      if (!client || !verifyClientSecret(client, body.client_secret)) {
        set.status = 401
        return { error: 'invalid_client' as const }
      }

      const now = new Date()
      const [authCode] = await db
        .select()
        .from(oidcAuthCodes)
        .where(
          and(
            eq(oidcAuthCodes.codeHash, hashToken(body.code)),
            isNull(oidcAuthCodes.usedAt),
            gt(oidcAuthCodes.expiresAt, now),
          ),
        )
        .limit(1)

      if (
        !authCode ||
        authCode.clientSlug !== client.slug ||
        authCode.redirectUri !== body.redirect_uri
      ) {
        set.status = 400
        return { error: 'invalid_grant' as const }
      }

      await db.update(oidcAuthCodes).set({ usedAt: now }).where(eq(oidcAuthCodes.id, authCode.id))

      // Sessão precisa continuar viva entre o authorize e o token — logout no
      // meio do fluxo invalida o código.
      const [activeSession] = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(and(eq(sessions.id, authCode.sessionId), gt(sessions.expiresAt, now)))
        .limit(1)

      if (!activeSession) {
        set.status = 400
        return { error: 'invalid_grant' as const }
      }

      const [user] = await db.select().from(users).where(eq(users.id, authCode.userId)).limit(1)
      if (!user) {
        set.status = 400
        return { error: 'invalid_grant' as const }
      }

      const { token, expiresIn } = await signUserToken({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          avatarFrame: user.avatarFrame,
        },
        sessionId: authCode.sessionId,
        clientSlug: client.slug,
        nonce: authCode.nonce,
      })

      return {
        access_token: token,
        id_token: token,
        token_type: 'Bearer' as const,
        expires_in: expiresIn,
      }
    },
    {
      body: t.Object({
        grant_type: t.String(),
        code: t.String(),
        client_id: t.String(),
        client_secret: t.String(),
        redirect_uri: t.String(),
      }),
    },
  )

  // Validação de sessão ativa — base do single sign-out. Consultada pelos
  // produtos em pontos sensíveis.
  .post(
    '/oidc/introspect',
    async ({ body, set }) => {
      const client = await getActiveClient(body.client_id)
      if (!client || !verifyClientSecret(client, body.client_secret)) {
        set.status = 401
        return { error: 'invalid_client' as const }
      }

      return await introspectToken(body.token)
    },
    {
      body: t.Object({
        token: t.String(),
        client_id: t.String(),
        client_secret: t.String(),
      }),
    },
  )

  .get('/.well-known/jwks.json', async () => {
    return await getJwks()
  })
