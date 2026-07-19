import { and, eq, sql } from 'drizzle-orm'
import { db, workspaceFiles } from '@vianova/db'
import { resolveWorkspaceLimits } from './product-sync'

export async function getWorkspaceFileUsage(
  productSlug: string,
  workspaceId: string,
  status: 'active' | 'trashed' = 'active',
): Promise<{ usedBytes: number; fileCount: number }> {
  const [row] = await db
    .select({
      usedBytes: sql<number>`coalesce(sum(${workspaceFiles.sizeBytes}), 0)`,
      fileCount: sql<number>`count(*)`,
    })
    .from(workspaceFiles)
    .where(
      and(
        eq(workspaceFiles.productSlug, productSlug),
        eq(workspaceFiles.workspaceId, workspaceId),
        eq(workspaceFiles.status, status),
      ),
    )

  return {
    usedBytes: Number(row?.usedBytes ?? 0),
    fileCount: Number(row?.fileCount ?? 0),
  }
}

export async function getWorkspaceFileLimits(
  productSlug: string,
  workspaceId: string,
): Promise<{ storageBytes: number; maxFileSizeBytes: number }> {
  const resolved = await resolveWorkspaceLimits(productSlug, workspaceId)
  const limits = resolved?.limits ?? {}

  return {
    storageBytes: limits.storageBytes ?? 0,
    maxFileSizeBytes: limits.maxFileSizeBytes ?? 0,
  }
}

export async function checkFileQuota(
  productSlug: string,
  workspaceId: string,
  fileSizeBytes: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const limits = await getWorkspaceFileLimits(productSlug, workspaceId)

  if (limits.maxFileSizeBytes > 0 && fileSizeBytes > limits.maxFileSizeBytes) {
    return {
      ok: false,
      reason: `Arquivo excede o tamanho máximo permitido para este plano (${formatBytes(limits.maxFileSizeBytes)}).`,
    }
  }

  if (limits.storageBytes <= 0) {
    return {
      ok: false,
      reason: 'Este workspace não tem quota de storage disponível. Faça upgrade ou adicione storage extra.',
    }
  }

  const { usedBytes } = await getWorkspaceFileUsage(productSlug, workspaceId, 'active')
  if (usedBytes + fileSizeBytes > limits.storageBytes) {
    return {
      ok: false,
      reason: `Storage insuficiente. Você usa ${formatBytes(usedBytes)} de ${formatBytes(limits.storageBytes)}.`,
    }
  }

  return { ok: true }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log10(bytes) / Math.log10(1024))
  const value = bytes / 1024 ** i
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
