import { Queue, Worker } from 'bullmq'
import { syncEntitlements, notifySessionRevoked } from './product-sync'

// Trabalho assíncrono (sync de entitlements, revogação de sessão nos produtos)
// nunca roda síncrono numa resposta HTTP — sempre via fila.
// No Milestone 1 o worker roda in-process na API (deploy único).

const QUEUE_NAME = 'vianova'

export interface EntitlementsSyncJob {
  type: 'entitlements:sync'
  productSlug: string
  workspaceId: string
}

export interface SessionRevokedJob {
  type: 'session:revoked'
  userId: string
  sessionIds: string[]
}

export type VianovaJob = EntitlementsSyncJob | SessionRevokedJob

let queue: Queue | null = null

function getConnection() {
  const url = new URL(process.env.VIANOVA_REDIS_URL ?? 'redis://localhost:6380')
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: url.password } : {}),
    maxRetriesPerRequest: null,
  }
}

function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: getConnection() })
  }
  return queue
}

export async function enqueue(job: VianovaJob) {
  try {
    await getQueue().add(job.type, job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    })
  } catch (err) {
    console.error(`[queue] falha ao enfileirar ${job.type}:`, err)
  }
}

export function startWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const data = job.data as VianovaJob
      if (data.type === 'entitlements:sync') {
        await syncEntitlements(data.productSlug, data.workspaceId)
      } else if (data.type === 'session:revoked') {
        await notifySessionRevoked(data.userId, data.sessionIds)
      }
    },
    { connection: getConnection() },
  )

  worker.on('failed', (job, err) => {
    console.error(`[queue] job ${job?.name} falhou:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('[queue] worker error:', err.message)
  })

  return worker
}
