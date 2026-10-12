import { Elysia, t } from 'elysia'
import { createHash, timingSafeEqual } from 'node:crypto'
import { db, productCatalog, oidcAuthCodes, oidcRefreshTokens, users, sessions } from '@vianova/db'
import { eq, and, gt, isNull } from 'drizzle-orm'
import { getJwks, signUserToken, introspectToken } from '@vianova/oidc'
import { notifySessionRevoked } from '../lib/product-sync'
import { generateId, generateToken, hashToken } from '../lib/crypto'
import { authPlugin } from '../plugins/auth'
import { getCookieOptions, requireEnv } from '../lib/env'
import { deleteSession, SESSION_COOKIE } from '../lib/session'

const AUTH_CODE_TTL_MS = 60 * 1000
const REFRESH_TOKEN_TTL_DAYS = 30

const WEB_URL = requireEnv('VIANOVA_WEB_URL')

async function getActiveClient(clientId: string) {
  const [client] = await db
    .select()
    .from(productCatalog)
    .where(and(eq(productCatalog.slug, clientId), eq(productCatalog.isActive, true)))
    .limit(1)
  return client ?? null
}

function verifyClientSecret(client: { oidcClientSecretHash: string }, secret: string): boolean {
  const a = Buffer.from(hashToken(secret))
  const b = Buffer.from(client.oidcClientSecretHash)
  return a.length === b.length && timingSafeEqual(a, b)
}

function verifyPkce(
  codeVerifier: string | undefined,
  challenge: string,
  method: string | null,
): boolean {
  if (method !== 'S256' || !codeVerifier) return false
  const derived = createHash('sha256').update(codeVerifier).digest('base64url')
  const a = Buffer.from(derived)
  const b = Buffer.from(challenge)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const oidcRoutes = new Elysia()
  .use(authPlugin)

  .get(
    '/oidc/authorize',
    async ({ query, session, set, redirect, request }) => {
      const { client_id, redirect_uri, state, scope, nonce } = query

      const client = await getActiveClient(client_id)
      if (!client) {
        set.status = 400
        return { message: 'client_id desconhecido.' }
      }

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
        codeChallenge: query.code_challenge ?? null,
        codeChallengeMethod: query.code_challenge ? (query.code_challenge_method ?? 'plain') : null,
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
        code_challenge: t.Optional(t.String()),
        code_challenge_method: t.Optional(t.String()),
      }),
    },
  )

  .post(
    '/oidc/token',
    async ({ body, set }) => {
      const client = await getActiveClient(body.client_id)
      if (!client || !verifyClientSecret(client, body.client_secret)) {
        set.status = 401
        return { error: 'invalid_client' as const }
      }

      if (body.grant_type === 'refresh_token') {
        if (!body.refresh_token) {
          set.status = 400
          return { error: 'invalid_request' as const }
        }

        const now = new Date()
        const tokenHash = hashToken(body.refresh_token)

        const [existing] = await db
          .update(oidcRefreshTokens)
          .set({ usedAt: now })
          .where(
            and(
              eq(oidcRefreshTokens.tokenHash, tokenHash),
              isNull(oidcRefreshTokens.usedAt),
              gt(oidcRefreshTokens.expiresAt, now),
              eq(oidcRefreshTokens.clientSlug, client.slug),
            ),
          )
          .returning()

        if (!existing) {
          set.status = 400
          return { error: 'invalid_grant' as const }
        }

        const [activeSession] = await db
          .select({ id: sessions.id })
          .from(sessions)
          .where(and(eq(sessions.id, existing.sessionId), gt(sessions.expiresAt, now)))
          .limit(1)

        if (!activeSession) {
          set.status = 400
          return { error: 'invalid_grant' as const }
        }

        const [user] = await db.select().from(users).where(eq(users.id, existing.userId)).limit(1)
        if (!user) {
          set.status = 400
          return { error: 'invalid_grant' as const }
        }

        const newRefreshToken = generateToken()
        await db.insert(oidcRefreshTokens).values({
          id: generateId(),
          tokenHash: hashToken(newRefreshToken),
          userId: existing.userId,
          sessionId: existing.sessionId,
          clientSlug: client.slug,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
        })

        const { token, expiresIn } = await signUserToken({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            avatarFrame: user.avatarFrame,
            emailVerifiedAt: user.emailVerifiedAt,
          },
          sessionId: existing.sessionId,
          clientSlug: client.slug,
        })

        return {
          access_token: token,
          id_token: token,
          token_type: 'Bearer' as const,
          expires_in: expiresIn,
          refresh_token: newRefreshToken,
          refresh_token_expires_in: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
        }
      }

      if (body.grant_type !== 'authorization_code') {
        set.status = 400
        return { error: 'unsupported_grant_type' as const }
      }

      if (!body.code || !body.redirect_uri) {
        set.status = 400
        return { error: 'invalid_request' as const }
      }

      const now = new Date()
      const [authCode] = await db
        .update(oidcAuthCodes)
        .set({ usedAt: now })
        .where(
          and(
            eq(oidcAuthCodes.codeHash, hashToken(body.code)),
            isNull(oidcAuthCodes.usedAt),
            gt(oidcAuthCodes.expiresAt, now),
          ),
        )
        .returning()

      if (
        !authCode ||
        authCode.clientSlug !== client.slug ||
        authCode.redirectUri !== body.redirect_uri
      ) {
        set.status = 400
        return { error: 'invalid_grant' as const }
      }

      if (authCode.codeChallenge) {
        if (!verifyPkce(body.code_verifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
          set.status = 400
          return { error: 'invalid_grant' as const }
        }
      }

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
          emailVerifiedAt: user.emailVerifiedAt,
        },
        sessionId: authCode.sessionId,
        clientSlug: client.slug,
        nonce: authCode.nonce,
      })

      const refreshToken = generateToken()
      await db.insert(oidcRefreshTokens).values({
        id: generateId(),
        tokenHash: hashToken(refreshToken),
        userId: authCode.userId,
        sessionId: authCode.sessionId,
        clientSlug: client.slug,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      })

      return {
        access_token: token,
        id_token: token,
        token_type: 'Bearer' as const,
        expires_in: expiresIn,
        refresh_token: refreshToken,
        refresh_token_expires_in: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
      }
    },
    {
      body: t.Object({
        grant_type: t.String(),
        code: t.Optional(t.String()),
        client_id: t.String(),
        client_secret: t.String(),
        redirect_uri: t.Optional(t.String()),
        refresh_token: t.Optional(t.String()),
        code_verifier: t.Optional(t.String()),
      }),
    },
  )

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

  .get(
    '/oidc/end_session',
    async ({ query, session, cookie, redirect }) => {
      const { post_logout_redirect_uri } = query

      if (session) {
        const token = cookie[SESSION_COOKIE]?.value as string | undefined
        if (token) {
          const deletedSessionId = await deleteSession(token)
          if (deletedSessionId) {
            await notifySessionRevoked(session.userId, [deletedSessionId])
          }
        }
        cookie[SESSION_COOKIE].set({ value: '', ...getCookieOptions(), maxAge: 0 })
      }

      if (post_logout_redirect_uri) {
        const products = await db.select({ redirectUris: productCatalog.redirectUris }).from(productCatalog)
        const allUris = products.flatMap((p) => p.redirectUris)
        const isAllowed = allUris.some((uri) => {
          try {
            const allowed = new URL(uri)
            const candidate = new URL(post_logout_redirect_uri)
            return allowed.origin === candidate.origin
          } catch {
            return false
          }
        })

        if (isAllowed) {
          return redirect(post_logout_redirect_uri, 302)
        }
      }

      return redirect(`${WEB_URL}/login`, 302)
    },
    {
      query: t.Object({
        post_logout_redirect_uri: t.Optional(t.String()),
      }),
    },
  )

  .get('/.well-known/jwks.json', async () => {
    return await getJwks()
  })
