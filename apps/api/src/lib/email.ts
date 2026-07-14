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

function baseTemplate(title: string, body: string, ctaUrl: string, ctaText: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F4F4F2;font-family:Inter,ui-sans-serif,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F2;padding:48px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 4px 12px rgba(28,27,46,0.08);overflow:hidden;">
          <tr>
            <td style="padding:32px 40px 0 40px;">
              <span style="font-size:22px;font-weight:700;color:#1C1B2E;letter-spacing:-0.5px;">vianova</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px 40px;">
              <a href="${ctaUrl}" style="display:inline-block;background:#4053F0;color:#ffffff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">${ctaText}</a>
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
    // Dev sem SMTP: loga o link para o fluxo continuar testável.
    console.log(`[email:dev] ${label} → ${to}: ${ctaUrl}`)
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
  await send(to, 'Confirme seu email — Vianova', baseTemplate('Confirme seu email', body, verifyUrl, 'Confirmar email'), verifyUrl, 'sendVerificationEmail')
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1C1B2E;">Redefinir senha</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;">Olá, ${name}! Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para criar uma nova senha.</p>
    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">O link expira em 1 hora.</p>
  `
  await send(to, 'Redefinir senha — Vianova', baseTemplate('Redefinir senha', body, resetUrl, 'Redefinir senha'), resetUrl, 'sendPasswordResetEmail')
}
