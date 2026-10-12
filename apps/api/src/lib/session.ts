import { db, sessions, loginChallenges } from '@vianova/db'
import { eq, and, gt, isNull } from 'drizzle-orm'
import { generateId, generateToken, hashToken } from './crypto'
import { introspectToken } from '@vianova/oidc'

const SESSION_TTL_DAYS = 30
const LOGIN_CHALLENGE_TTL_MINUTES = 5

export const SESSION_COOKIE = 'vianova_session'

export async function createSession(
  userId: string,
  ip?: string,
  userAgent?: string,
): Promise<{ token: string; sessionId: string }> {
  const token = generateToken()
  const tokenHash = hashToken(token)
  const sessionId = generateId()
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    tokenHash,
    expiresAt,
    ip: ip ?? null,
    userAgent: userAgent ?? null,
  })

  return { token, sessionId }
}

export async function validateSession(
  token: string,
): Promise<{ userId: string; sessionId: string } | null> {
  const tokenHash = hashToken(token)
  const now = new Date()

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1)

  if (!session) return null

  return { userId: session.userId, sessionId: session.id }
}

export async function validateJwtSession(
  jwt: string,
): Promise<{ userId: string; sessionId: string } | null> {
  const introspection = await introspectToken(jwt)
  if (!introspection.active) return null
  return { userId: introspection.sub, sessionId: introspection.sid }
}

export async function deleteSession(token: string): Promise<string | null> {
  const tokenHash = hashToken(token)
  const [deleted] = await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .returning({ id: sessions.id, userId: sessions.userId })
  return deleted?.id ?? null
}

export async function createLoginChallenge(
  userId: string,
  ip?: string,
  userAgent?: string,
): Promise<{ token: string; challengeId: string }> {
  const token = generateToken()
  const tokenHash = hashToken(token)
  const challengeId = generateId()
  const expiresAt = new Date(Date.now() + LOGIN_CHALLENGE_TTL_MINUTES * 60 * 1000)

  await db.insert(loginChallenges).values({
    id: challengeId,
    userId,
    tokenHash,
    ip: ip ?? null,
    userAgent: userAgent ?? null,
    expiresAt,
  })

  return { token, challengeId }
}

export async function validateLoginChallenge(
  token: string,
): Promise<{ userId: string; challengeId: string } | null> {
  const tokenHash = hashToken(token)
  const now = new Date()

  const [challenge] = await db
    .update(loginChallenges)
    .set({ usedAt: now })
    .where(
      and(
        eq(loginChallenges.tokenHash, tokenHash),
        gt(loginChallenges.expiresAt, now),
        isNull(loginChallenges.usedAt),
      ),
    )
    .returning({ userId: loginChallenges.userId, challengeId: loginChallenges.id })

  if (!challenge) return null
  return { userId: challenge.userId, challengeId: challenge.challengeId }
}
