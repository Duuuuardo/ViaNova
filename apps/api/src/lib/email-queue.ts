import { Queue } from 'bullmq'
import { requireEnv } from './env'

export interface EmailEnqueueJob {
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

const EMAIL_QUEUE_NAME = 'vianova-email'

function getConnection() {
  const url = new URL(requireEnv('VIANOVA_REDIS_URL'))
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: url.password } : {}),
    maxRetriesPerRequest: null,
  }
}

let queue: Queue | null = null

export function getEmailQueue(): Queue {
  if (!queue) {
    queue = new Queue(EMAIL_QUEUE_NAME, { connection: getConnection() })
  }
  return queue
}

export async function enqueueEmail(job: EmailEnqueueJob): Promise<void> {
  await getEmailQueue().add(job.type, job, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  })
}
