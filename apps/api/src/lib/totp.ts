import * as OTPAuth from 'otpauth'

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32
}

export function getTotpUri(email: string, secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: process.env.TOTP_ISSUER ?? 'Vianova',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  })
  return totp.toString()
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    })
    const delta = totp.validate({ token, window: 1 })
    return delta !== null
  } catch {
    return false
  }
}
