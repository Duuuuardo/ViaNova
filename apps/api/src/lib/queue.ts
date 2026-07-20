import { Queue, Worker } from 'bullmq'
import { and, eq, lt } from 'drizzle-orm'
import { db, workspaceFiles } from '@vianova/db'
import { syncEntitlements, notifySessionRevoked, grantCredits, resetCredits } from './product-sync'
import { deleteWorkspaceFile } from './storage'
import { sendRenewalReminders } from './billing-reminders'
import { requireEnv } from './env'

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

export interface CreditsGrantJob {
  type: 'credits:grant'
  productSlug: string
  workspaceId: string
  amount: number
}

export interface CreditsResetJob {
  type: 'credits:reset'
  productSlug: string
  workspaceId: string
}

export interface FilesCleanupJob {
  type: 'files:cleanup'
}

export interface BillingReminderJob {
  type: 'billing:reminder'
}

export type VianovaJob = EntitlementsSyncJob | SessionRevokedJob | CreditsGrantJob | CreditsResetJob | FilesCleanupJob | BillingReminderJob

let queue: Queue | null = null

function getConnection() {
  const url = new URL(requireEnv('VIANOVA_REDIS_URL'))
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

// Remove arquivos na lixeira há mais de 30 dias (hard delete no MinIO + banco).
export async function cleanupTrashedFiles() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  let rows: Array<{ id: string; s3Key: string }> = []
  try {
    rows = await db
      .select({ id: workspaceFiles.id, s3Key: workspaceFiles.s3Key })
      .from(workspaceFiles)
      .where(and(eq(workspaceFiles.status, 'trashed'), lt(workspaceFiles.trashedAt, cutoff)))
      .limit(500)
  } catch (err) {
    console.error('[files:cleanup] erro ao consultar lixeira:', err)
    return 0
  }

  let deleted = 0
  for (const row of rows) {
    try {
      await deleteWorkspaceFile(row.s3Key)
      await db.delete(workspaceFiles).where(eq(workspaceFiles.id, row.id))
      deleted++
    } catch (err) {
      console.error(`[files:cleanup] erro ao remover arquivo ${row.id}:`, err)
    }
  }

  if (deleted > 0) {
    console.log(`[files:cleanup] ${deleted} arquivo(s) removidos permanentemente`)
  }
  return deleted
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
      } else if (data.type === 'credits:grant') {
        await grantCredits(data.productSlug, data.workspaceId, data.amount)
      } else if (data.type === 'credits:reset') {
        await resetCredits(data.productSlug, data.workspaceId)
      } else if (data.type === 'files:cleanup') {
        await cleanupTrashedFiles()
      } else if (data.type === 'billing:reminder') {
        await sendRenewalReminders()
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

  // Agenda o primeiro cleanup no startup com jobId fixo para evitar
  // filas duplicadas a cada hot-reload do dev server.
  getQueue()
    .add(
      'files:cleanup',
      { type: 'files:cleanup' },
      {
        jobId: 'files:cleanup:recurring',
        repeat: { pattern: '0 4 * * *' },
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    )
    .catch(() => {})

  // Lembrete de renovação: roda uma vez por dia ao meio-dia.
  getQueue()
    .add(
      'billing:reminder',
      { type: 'billing:reminder' },
      {
        jobId: 'billing:reminder:recurring',
        repeat: { pattern: '0 12 * * *' },
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    )
    .catch(() => {})

  return worker
}
