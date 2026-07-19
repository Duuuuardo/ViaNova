import { startEmailWorker, type EmailJob } from './queue'
import { defaultFrom, sendEmail } from './sender'

console.log('[email-worker] iniciando...')

startEmailWorker(async (job) => {
  const data = job.data
  if (data.type !== 'email:send') {
    console.warn(`[email-worker] tipo de job ignorado: ${data.type}`)
    return
  }

  await sendEmail({
    from: data.from ?? defaultFrom(data.brand),
    to: data.to,
    subject: data.subject,
    html: data.html,
    replyTo: data.replyTo,
  })

  console.log(`[email-worker] enviado: ${data.subject} → ${data.to}`)
})
