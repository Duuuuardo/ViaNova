import { Queue, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`[email-worker] ${name} is required`)
  }
  return value
}

export const EMAIL_QUEUE_NAME = 'vianova-email'

export interface EmailJob {
  type: 'email:send'
  to: string
  subject: string
  html: string
  brand: 'vianova' | 'naia' | 'crm'
  from?: string
  replyTo?: string
  metadata?: {
    sourceProduct?: string
    sourceWorkspaceId?: string
  }
}

function getConnection() {
  const url = new URL(requireEnv('VIANOVA_REDIS_URL'))
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: url.password } : {}),
    maxRetriesPerRequest: null,
  }
}

export function getRedis(): IORedis {
  return new IORedis(getConnection())
}

export function getEmailQueue(): Queue {
  return new Queue(EMAIL_QUEUE_NAME, { connection: getConnection() })
}

export function startEmailWorker(processor: (job: Job<EmailJob>) => Promise<void>): Worker {
  const worker = new Worker<EmailJob>(EMAIL_QUEUE_NAME, processor, {
    connection: getConnection(),
  })

  worker.on('failed', (job, err) => {
    console.error(`[email-worker] job ${job?.name} falhou:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('[email-worker] worker error:', err.message)
  })

  return worker
}
