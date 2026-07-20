import { createHmac } from 'node:crypto'
import { getTokenHashSalt } from './env'

export function generateId(): string {
  return crypto.randomUUID()
}

export function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('hex')
}

export function hashToken(token: string): string {
  return createHmac('sha256', getTokenHashSalt()).update(token).digest('hex')
}

export function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const bytes = new Uint8Array(6)
    crypto.getRandomValues(bytes)
    return Buffer.from(bytes).toString('hex').slice(0, 8).toUpperCase()
  })
}
