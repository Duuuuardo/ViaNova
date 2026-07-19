import { BRANDS, type EmailBrand } from './sender'

export interface EmailTemplate {
  title: string
  bodyHtml: string
  ctaUrl?: string
  ctaText?: string
}

export function baseTemplate(
  template: EmailTemplate,
  brand: EmailBrand = 'vianova',
): string {
  const config = BRANDS[brand]
  const cta = template.ctaUrl
    ? `<tr>
        <td style="padding:0 40px 32px 40px;">
          <a href="${template.ctaUrl}" style="display:inline-block;background:${config.color};color:#ffffff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">${template.ctaText ?? 'Acessar'}</a>
        </td>
      </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${template.title}</title>
  ${config.fontImport ?? ''}
</head>
<body style="margin:0;padding:0;background:#F4F4F2;font-family:${config.fontFamily};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F2;padding:48px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 4px 12px rgba(28,27,46,0.08);overflow:hidden;">
          <tr>
            <td style="padding:32px 40px 0 40px;">
              <span style="font-size:22px;font-weight:700;color:#1C1B2E;letter-spacing:-0.5px;">${config.name}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;">
              ${template.bodyHtml}
            </td>
          </tr>
          ${cta}
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

export function buildGenericEmail(opts: {
  title: string
  description: string
  brand: EmailBrand
  actionUrl?: string
  actionLabel?: string
}): { subject: string; html: string } {
  const subject = opts.title
  const html = baseTemplate(
    {
      title: opts.title,
      bodyHtml: `<h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1C1B2E;">${opts.title}</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;">${opts.description}</p>`,
      ctaUrl: opts.actionUrl,
      ctaText: opts.actionLabel,
    },
    opts.brand,
  )
  return { subject, html }
}
