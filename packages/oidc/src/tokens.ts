import { db, sessions, serviceTokens } from '@vianova/db'
import { eq, and, gt } from 'drizzle-orm'
import { SignJWT, jwtVerify, createLocalJWKSet, type JWTPayload } from 'jose'
import { getSigningKey, getJwks, ALG } from './keys'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`[oidc] ${name} is required`)
  }
  return value
}

export const ISSUER = requireEnv('VIANOVA_API_URL')

const USER_TOKEN_TTL_SECONDS = 60 * 60
const SERVICE_TOKEN_TTL_SECONDS = 5 * 60

export interface UserTokenInput {
  user: {
    id: string
    email: string
    name: string
    avatarUrl?: string | null
    avatarFrame?: string | null
    emailVerifiedAt?: Date | null
  }
  sessionId: string
  clientSlug: string
  nonce?: string | null
}

export async function signUserToken({ user, sessionId, clientSlug, nonce }: UserTokenInput) {
  const { kid, privateKey } = await getSigningKey()

  const jwt = new SignJWT({
    email: user.email,
    name: user.name,
    email_verified: user.emailVerifiedAt != null,
    ...(user.avatarUrl ? { picture: user.avatarUrl } : {}),
    ...(user.avatarFrame ? { picture_frame: user.avatarFrame } : {}),
    sid: sessionId,
    ...(nonce ? { nonce } : {}),
  })
    .setProtectedHeader({ alg: ALG, kid })
    .setIssuer(ISSUER)
    .setSubject(user.id)
    .setAudience(clientSlug)
    .setIssuedAt()
    .setExpirationTime(`${USER_TOKEN_TTL_SECONDS}s`)
    .setJti(crypto.randomUUID())

  return { token: await jwt.sign(privateKey), expiresIn: USER_TOKEN_TTL_SECONDS }
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const jwks = createLocalJWKSet(await getJwks())
    const { payload } = await jwtVerify(token, jwks, { issuer: ISSUER })
    return payload
  } catch {
    return null
  }
}

export async function introspectToken(token: string): Promise<
  | { active: false }
  | { active: true; sub: string; sid: string; aud?: string | string[]; exp?: number; scope?: string }
> {
  const payload = await verifyToken(token)
  if (!payload || !payload.sub) return { active: false }

  if (typeof payload.scope === 'string' && payload.scope.startsWith('service:')) {
    return {
      active: true,
      sub: payload.sub,
      sid: '',
      aud: payload.aud,
      exp: payload.exp,
      scope: payload.scope,
    }
  }

  const sid = payload.sid
  if (typeof sid !== 'string') return { active: false }

  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sid), gt(sessions.expiresAt, new Date())))
    .limit(1)

  if (!session) return { active: false }

  return { active: true, sub: payload.sub, sid, aud: payload.aud, exp: payload.exp }
}

export async function signServiceToken(productSlug: string, scope: string) {
  const { kid, privateKey } = await getSigningKey()
  const jti = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SERVICE_TOKEN_TTL_SECONDS * 1000)

  const token = await new SignJWT({ scope })
    .setProtectedHeader({ alg: ALG, kid })
    .setIssuer(ISSUER)
    .setSubject('vianova-service')
    .setAudience(productSlug)
    .setIssuedAt()
    .setExpirationTime(`${SERVICE_TOKEN_TTL_SECONDS}s`)
    .setJti(jti)
    .sign(privateKey)

  await db.insert(serviceTokens).values({
    id: crypto.randomUUID(),
    jti,
    productSlug,
    scope,
    expiresAt,
  })

  return { token, expiresIn: SERVICE_TOKEN_TTL_SECONDS }
}
