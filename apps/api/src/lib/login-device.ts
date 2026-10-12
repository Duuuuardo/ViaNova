import { and, eq } from 'drizzle-orm'
import { db, loginDevices } from '@vianova/db'
import { generateId, generateToken, hashToken } from './crypto'

export const LOGIN_DEVICE_COOKIE = 'vianova_login_device'
export const LOGIN_DEVICE_MAX_AGE = 60 * 60 * 24 * 365

interface RecordLoginDeviceOptions {
  userId: string
  deviceToken?: string
  ip?: string
  userAgent?: string
}

export async function recordLoginDevice({
  userId,
  deviceToken,
  ip,
  userAgent,
}: RecordLoginDeviceOptions): Promise<{
  isNew: boolean
  token: string
  previousIp: string | null
  previousLocationKey: string | null
}> {
  if (deviceToken) {
    const tokenHash = hashToken(deviceToken)
    const [knownDevice] = await db
      .select({
        id: loginDevices.id,
        lastIp: loginDevices.lastIp,
        lastLocationKey: loginDevices.lastLocationKey,
      })
      .from(loginDevices)
      .where(and(eq(loginDevices.userId, userId), eq(loginDevices.tokenHash, tokenHash)))
      .limit(1)

    if (knownDevice) {
      await db
        .update(loginDevices)
        .set({
          lastIp: ip ?? null,
          lastUserAgent: userAgent ?? null,
          lastSeenAt: new Date(),
        })
        .where(eq(loginDevices.id, knownDevice.id))
      return {
        isNew: false,
        token: deviceToken,
        previousIp: knownDevice.lastIp,
        previousLocationKey: knownDevice.lastLocationKey,
      }
    }
  }

  const token = deviceToken ?? generateToken()
  await db.insert(loginDevices).values({
    id: generateId(),
    userId,
    tokenHash: hashToken(token),
    lastIp: ip ?? null,
    lastUserAgent: userAgent ?? null,
    lastLocationKey: null,
  })

  return { isNew: true, token, previousIp: null, previousLocationKey: null }
}

export async function updateLoginDeviceLocation(
  userId: string,
  token: string,
  locationKey: string,
): Promise<void> {
  await db
    .update(loginDevices)
    .set({ lastLocationKey: locationKey, lastSeenAt: new Date() })
    .where(and(
      eq(loginDevices.userId, userId),
      eq(loginDevices.tokenHash, hashToken(token)),
    ))
}
