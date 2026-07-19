import nodemailer from 'nodemailer'

export type EmailBrand = 'vianova' | 'naia' | 'crm'

interface SendOptions {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
}

export interface BrandConfig {
  name: string
  domain: string
  color: string
  fontFamily: string
  fontImport?: string
}

export const BRANDS: Record<EmailBrand, BrandConfig> = {
  vianova: {
    name: 'Vianova',
    domain: 'vianova.software',
    color: '#C466FF',
    fontFamily: "'Public Sans Variable', Inter, ui-sans-serif, sans-serif",
  },
  naia: {
    name: 'Naia Campanhas',
    domain: 'campaigns.naia.website',
    color: '#DD5973',
    fontFamily: "'Plus Jakarta Sans', ui-sans-serif, sans-serif",
    fontImport:
      '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">',
  },
  crm: {
    name: 'Naia CRM',
    domain: 'crm.naia.website',
    color: '#DD5973',
    fontFamily: "'Plus Jakarta Sans', ui-sans-serif, sans-serif",
    fontImport:
      '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">',
  },
}

function getTransporter() {
  const host = process.env.SMTP_HOST
  if (!host) return null
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
}

export function defaultFrom(brand: EmailBrand): string {
  const config = BRANDS[brand]
  return `${config.name} <no-reply@${config.domain}>`
}

export async function sendEmail(options: SendOptions): Promise<void> {
  const transporter = getTransporter()
  if (!transporter) {
    console.log(`[email-worker:dev] to=${options.to} subject="${options.subject}"`)
    return
  }
  await transporter.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    replyTo: options.replyTo,
  })
}
