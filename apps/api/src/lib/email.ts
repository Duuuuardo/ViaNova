import nodemailer from 'nodemailer'

const FROM = process.env.SMTP_FROM ?? 'Vianova <no-reply@vianova.software>'

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

type EmailBrand = 'vianova' | 'naia'

function baseTemplate(
  title: string,
  body: string,
  ctaUrl: string,
  ctaText: string,
  brand: EmailBrand = 'vianova',
): string {
  const isNaia = brand === 'naia'
  const brandName = isNaia ? 'Naia Campanhas' : 'vianova'
  const brandColor = isNaia ? '#DD5973' : '#C466FF'
  const fontFamily = isNaia
    ? "'Plus Jakarta Sans', ui-sans-serif, sans-serif"
    : 'Inter, ui-sans-serif, sans-serif'
  const fontImport = isNaia
    ? `<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  ${fontImport}
</head>
<body style="margin:0;padding:0;background:#F4F4F2;font-family:${fontFamily};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F2;padding:48px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 4px 12px rgba(28,27,46,0.08);overflow:hidden;">
          <tr>
            <td style="padding:32px 40px 0 40px;">
              <span style="font-size:22px;font-weight:700;color:#1C1B2E;letter-spacing:-0.5px;">${brandName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px 40px;">
              <a href="${ctaUrl}" style="display:inline-block;background:${brandColor};color:#ffffff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">${ctaText}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #E7E6E1;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">Se você não solicitou isso, pode ignorar este email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function send(to: string, subject: string, html: string, ctaUrl: string, label: string) {
  const transporter = getTransporter()
  if (!transporter) {
    console.log(`[email:dev] ${label}`)
    return
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html })
  } catch (err) {
    console.error(`[email] ${label} failed:`, err)
  }
}

export async function sendVerificationEmail(to: string, name: string, verifyUrl: string) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1C1B2E;">Confirme seu email</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;">Olá, ${name}! Clique no botão abaixo para confirmar seu endereço de email e ativar sua conta Vianova.</p>
    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">O link expira em 24 horas.</p>
  `
  await send(to, 'Confirme seu email', baseTemplate('Confirme seu email', body, verifyUrl, 'Confirmar email'), verifyUrl, 'sendVerificationEmail')
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

import { requireEnv } from './env'

const WEB_URL = requireEnv('VIANOVA_WEB_URL')
const BILLING_URL = () => `${WEB_URL}/billing`

export async function sendSubscriptionConfirmedEmail(
  to: string,
  name: string,
  productName: string,
  planName: string,
) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1C1B2E;">Assinatura confirmada</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;">Olá, ${name}! Sua assinatura do plano <strong>${planName}</strong> no <strong>${productName}</strong> está ativa. Os novos limites do seu workspace já valem a partir de agora.</p>
  `
  await send(to, `Assinatura confirmada: ${productName}`, baseTemplate('Assinatura confirmada', body, BILLING_URL(), 'Ver assinaturas'), BILLING_URL(), 'sendSubscriptionConfirmedEmail')
}

export async function sendPlanChangedEmail(
  to: string,
  name: string,
  productName: string,
  planName: string,
) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1C1B2E;">Plano alterado</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;">Olá, ${name}! Seu plano no <strong>${productName}</strong> agora é o <strong>${planName}</strong>. A diferença de valor é ajustada proporcionalmente na próxima fatura.</p>
  `
  await send(to, `Plano alterado: ${productName}`, baseTemplate('Plano alterado', body, BILLING_URL(), 'Ver assinaturas'), BILLING_URL(), 'sendPlanChangedEmail')
}

export async function sendCancelScheduledEmail(
  to: string,
  name: string,
  productName: string,
  planName: string,
  periodEnd: Date,
) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1C1B2E;">Cancelamento agendado</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;">Olá, ${name}! O plano <strong>${planName}</strong> do <strong>${productName}</strong> permanece ativo até <strong>${formatDate(periodEnd)}</strong>. Depois disso, o workspace volta ao plano grátis. Você pode retomar a assinatura a qualquer momento antes dessa data.</p>
  `
  await send(to, `Seu plano no ${productName} expira em ${formatDate(periodEnd)}`, baseTemplate('Cancelamento agendado', body, BILLING_URL(), 'Retomar assinatura'), BILLING_URL(), 'sendCancelScheduledEmail')
}

export async function sendSubscriptionEndedEmail(
  to: string,
  name: string,
  productName: string,
) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1C1B2E;">Assinatura encerrada</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;">Olá, ${name}! Sua assinatura do <strong>${productName}</strong> foi encerrada e o workspace voltou ao plano grátis. Seus dados continuam intactos. Para recuperar os limites anteriores, basta assinar novamente.</p>
  `
  await send(to, `Assinatura encerrada: ${productName}`, baseTemplate('Assinatura encerrada', body, BILLING_URL(), 'Ver planos'), BILLING_URL(), 'sendSubscriptionEndedEmail')
}

export async function sendPaymentFailedEmail(
  to: string,
  name: string,
  productName: string,
) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1C1B2E;">Falha no pagamento</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;">Olá, ${name}! Não conseguimos processar o pagamento da sua assinatura do <strong>${productName}</strong>. Vamos tentar de novo automaticamente. Se o problema persistir, atualize a forma de pagamento para não perder acesso ao seu plano.</p>
  `
  await send(to, `Falha no pagamento: ${productName}`, baseTemplate('Falha no pagamento', body, BILLING_URL(), 'Atualizar pagamento'), BILLING_URL(), 'sendPaymentFailedEmail')
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1C1B2E;">Redefinir senha</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;">Olá, ${name}! Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para criar uma nova senha.</p>
    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">O link expira em 1 hora.</p>
  `
  await send(to, 'Redefinir sua senha', baseTemplate('Redefinir senha', body, resetUrl, 'Redefinir senha'), resetUrl, 'sendPasswordResetEmail')
}

function formatCurrency(cents: number, currency: string): string {
  const value = cents / 100
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(value)
}

export async function sendInvoicePaidEmail(
  to: string,
  name: string,
  productName: string,
  invoiceUrl: string,
  amountCents: number,
  currency: string,
  invoiceDate: Date,
) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1C1B2E;">Pagamento confirmado</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;">Olá, ${name}! Recebemos o pagamento da sua assinatura do <strong>${productName}</strong> no valor de <strong>${formatCurrency(amountCents, currency)}</strong> em ${formatDate(invoiceDate)}. A nota fiscal está disponível no link abaixo.</p>
  `
  await send(
    to,
    `Pagamento confirmado: ${productName}`,
    baseTemplate('Pagamento confirmado', body, invoiceUrl, 'Ver nota fiscal'),
    invoiceUrl,
    'sendInvoicePaidEmail',
  )
}

export async function sendUpcomingRenewalEmail(
  to: string,
  name: string,
  productName: string,
  planName: string,
  periodEnd: Date,
  daysLeft: number,
) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1C1B2E;">Sua assinatura renova em breve</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;">Olá, ${name}! O plano <strong>${planName}</strong> do <strong>${productName}</strong> renova automaticamente em <strong>${daysLeft} dia${daysLeft === 1 ? '' : 's'}</strong> (${formatDate(periodEnd)}). Certifique-se de que sua forma de pagamento está atualizada para evitar interrupções.</p>
  `
  await send(
    to,
    `Renovação em ${daysLeft} dia${daysLeft === 1 ? '' : 's'}: ${productName}`,
    baseTemplate('Renovação em breve', body, BILLING_URL(), 'Gerenciar pagamento'),
    BILLING_URL(),
    'sendUpcomingRenewalEmail',
  )
}

export async function sendSecurityAlertEmail(
  to: string,
  name: string,
  title: string,
  description: string,
  actionUrl?: string,
  actionLabel?: string,
) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1C1B2E;">${title}</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;">Olá, ${name}! ${description}</p>
  `
  const url = actionUrl ?? `${WEB_URL}/security`
  const label = actionLabel ?? 'Ver segurança da conta'
  await send(to, title, baseTemplate(title, body, url, label), url, 'sendSecurityAlertEmail')
}

export async function sendProductNotificationEmail(
  to: string,
  name: string,
  productName: string,
  title: string,
  description: string,
  actionUrl?: string,
  actionLabel?: string,
  brand: EmailBrand = 'vianova',
) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1C1B2E;">${title}</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;">Olá, ${name}! ${description}</p>
  `
  const url = actionUrl ?? `${WEB_URL}/notifications`
  const label = actionLabel ?? 'Ver notificações'
  const subject = productName ? `${productName}: ${title}` : title
  const html = baseTemplate(title, body, url, label, brand)
  await send(to, subject, html, url, 'sendProductNotificationEmail')
}
