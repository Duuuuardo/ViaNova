import { Elysia, t } from 'elysia'
import { and, eq, desc, sql, inArray } from 'drizzle-orm'
import { db, workspaceFiles, productCatalog, productSubscriptions, users, organizationMembers } from '@vianova/db'
import { generateId } from '../lib/crypto'
import {
  deleteWorkspaceFile,
  getWorkspaceFile,
  putWorkspaceFile,
  WORKSPACE_FILES_BUCKET,
} from '../lib/storage'
import {
  checkFileQuota,
  formatBytes,
  getWorkspaceFileLimits,
  getWorkspaceFileUsage,
} from '../lib/file-quota'
import {
  safeContentType,
  shouldForceDownload,
  validateWorkspaceFile,
} from '../lib/file-validation'
import { authPlugin } from '../plugins/auth'

const API_URL = process.env.VIANOVA_API_URL ?? 'http://localhost:5000'
const INTERNAL_SECRET = process.env.VIANOVA_INTERNAL_SECRET ?? 'vianova-internal-secret'

// Validação mínima para rotas internas chamadas pelos produtos.
function verifyInternalSecret(headers: Record<string, string | undefined>) {
  return headers['x-internal-secret'] === INTERNAL_SECRET
}

// Verifica se o usuário logado pode gerenciar o workspace no Vianova.
// Regra: owner da subscription ou membro da organização vinculada.
async function canManageWorkspace(
  userId: string,
  productSlug: string,
  workspaceId: string,
): Promise<boolean> {
  const [sub] = await db
    .select()
    .from(productSubscriptions)
    .where(
      and(
        eq(productSubscriptions.productSlug, productSlug),
        eq(productSubscriptions.workspaceId, workspaceId),
      ),
    )
    .limit(1)

  if (!sub) return false
  if (sub.ownerUserId === userId) return true
  if (!sub.organizationId) return false

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, sub.organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1)

  return Boolean(member)
}

async function canViewWorkspace(
  userId: string,
  productSlug: string,
  workspaceId: string,
): Promise<boolean> {
  return canManageWorkspace(userId, productSlug, workspaceId)
}

export const filesRoutes = new Elysia()
  .use(authPlugin)

  // --- Rotas internas (service-to-service, chamadas pelos produtos) ---

  .post(
    '/internal/files/upload',
    async ({ request, set }) => {
      const headers: Record<string, string | undefined> = Object.fromEntries(request.headers.entries())
      if (!verifyInternalSecret(headers)) {
        set.status = 401
        return { message: 'Não autorizado.' }
      }

      const form = await request.formData()
      const file = form.get('file')
      const productSlug = form.get('product_slug')
      const workspaceId = form.get('workspace_id')
      const ownerUserId = form.get('owner_user_id')

      if (!(file instanceof File)) {
        set.status = 422
        return { message: 'Arquivo não enviado.' }
      }
      if (typeof productSlug !== 'string' || typeof workspaceId !== 'string' || typeof ownerUserId !== 'string') {
        set.status = 422
        return { message: 'product_slug, workspace_id e owner_user_id são obrigatórios.' }
      }

      const [product] = await db
        .select({ slug: productCatalog.slug })
        .from(productCatalog)
        .where(eq(productCatalog.slug, productSlug))
        .limit(1)
      if (!product) {
        set.status = 404
        return { message: 'Produto não encontrado.' }
      }

      const [owner] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, ownerUserId))
        .limit(1)
      if (!owner) {
        set.status = 404
        return { message: 'Usuário não encontrado.' }
      }

      const validation = validateWorkspaceFile(file)
      if (!validation.ok) {
        set.status = 422
        return { message: validation.message }
      }

      const quotaCheck = await checkFileQuota(productSlug, workspaceId, file.size)
      if (!quotaCheck.ok) {
        set.status = 402
        return { message: quotaCheck.reason }
      }

      const limits = await getWorkspaceFileLimits(productSlug, workspaceId)
      if (limits.maxFileSizeBytes > 0 && file.size > limits.maxFileSizeBytes) {
        set.status = 422
        return {
          message: `Arquivo excede o limite de ${formatBytes(limits.maxFileSizeBytes)} do plano.`,
        }
      }

      const id = generateId()
      const s3Key = `${productSlug}/${workspaceId}/${id}.${validation.extension}`

      await putWorkspaceFile(s3Key, file)

      const [record] = await db
        .insert(workspaceFiles)
        .values({
          id,
          productSlug,
          workspaceId,
          ownerUserId,
          originalName: validation.sanitizedName,
          mimeType: validation.mimeType,
          sizeBytes: file.size,
          s3Key,
          s3Bucket: WORKSPACE_FILES_BUCKET,
        })
        .returning()

      return {
        id: record.id,
        url: `${API_URL}/files/assets/${record.id}/${encodeURIComponent(record.originalName)}`,
        sizeBytes: record.sizeBytes,
        mimeType: record.mimeType,
        originalName: record.originalName,
      }
    },
  )

  .get(
    '/internal/files',
    async ({ request, query, set }) => {
      const headers: Record<string, string | undefined> = Object.fromEntries(request.headers.entries())
      if (!verifyInternalSecret(headers)) {
        set.status = 401
        return { message: 'Não autorizado.' }
      }

      const status = query.status === 'trashed' ? 'trashed' : 'active'
      const limit = Math.min(100, Math.max(1, Number(query.limit ?? 50)))
      const cursor = typeof query.cursor === 'string' ? query.cursor : null
      const ownerUserId = typeof query.owner_user_id === 'string' ? query.owner_user_id : null

      const conditions = and(
        eq(workspaceFiles.productSlug, query.product_slug),
        eq(workspaceFiles.workspaceId, query.workspace_id),
        eq(workspaceFiles.status, status),
        ownerUserId ? eq(workspaceFiles.ownerUserId, ownerUserId) : undefined,
        cursor ? sql`${workspaceFiles.id} < ${cursor}` : undefined,
      )

      const rows = await db
        .select()
        .from(workspaceFiles)
        .where(conditions)
        .orderBy(desc(workspaceFiles.createdAt))
        .limit(limit + 1)

      const hasMore = rows.length > limit
      const items = hasMore ? rows.slice(0, -1) : rows
      const nextCursor = hasMore ? items[items.length - 1]?.id : null

      return {
        items: items.map((r) => ({
          id: r.id,
          url: `${API_URL}/files/assets/${r.id}/${encodeURIComponent(r.originalName)}`,
          originalName: r.originalName,
          mimeType: r.mimeType,
          sizeBytes: r.sizeBytes,
          status: r.status,
          createdAt: r.createdAt,
        })),
        nextCursor,
      }
    },
    {
      query: t.Object({
        product_slug: t.String(),
        workspace_id: t.String(),
        status: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
        owner_user_id: t.Optional(t.String()),
      }),
    },
  )

  .get(
    '/internal/files/usage',
    async ({ request, query, set }) => {
      const headers: Record<string, string | undefined> = Object.fromEntries(request.headers.entries())
      if (!verifyInternalSecret(headers)) {
        set.status = 401
        return { message: 'Não autorizado.' }
      }

      const [activeUsage, trashedUsage, limits] = await Promise.all([
        getWorkspaceFileUsage(query.product_slug, query.workspace_id, 'active'),
        getWorkspaceFileUsage(query.product_slug, query.workspace_id, 'trashed'),
        getWorkspaceFileLimits(query.product_slug, query.workspace_id),
      ])

      const quotaBytes = limits.storageBytes
      const usedBytes = activeUsage.usedBytes
      const percent = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0

      return {
        usedBytes,
        trashedBytes: trashedUsage.usedBytes,
        quotaBytes,
        maxFileSizeBytes: limits.maxFileSizeBytes,
        fileCount: activeUsage.fileCount,
        trashedCount: trashedUsage.fileCount,
        percent,
      }
    },
    {
      query: t.Object({
        product_slug: t.String(),
        workspace_id: t.String(),
      }),
    },
  )

  .delete(
    '/internal/files/:id',
    async ({ request, params, set }) => {
      const headers: Record<string, string | undefined> = Object.fromEntries(request.headers.entries())
      if (!verifyInternalSecret(headers)) {
        set.status = 401
        return { message: 'Não autorizado.' }
      }

      const [file] = await db
        .select()
        .from(workspaceFiles)
        .where(eq(workspaceFiles.id, params.id))
        .limit(1)

      if (!file) {
        set.status = 404
        return { message: 'Arquivo não encontrado.' }
      }
      if (file.status === 'trashed') {
        return { id: file.id, status: 'trashed' }
      }

      await db
        .update(workspaceFiles)
        .set({ status: 'trashed', trashedAt: new Date(), updatedAt: new Date() })
        .where(eq(workspaceFiles.id, file.id))

      return { id: file.id, status: 'trashed' }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  .post(
    '/internal/files/:id/restore',
    async ({ request, params, set }) => {
      const headers: Record<string, string | undefined> = Object.fromEntries(request.headers.entries())
      if (!verifyInternalSecret(headers)) {
        set.status = 401
        return { message: 'Não autorizado.' }
      }

      const [file] = await db
        .select()
        .from(workspaceFiles)
        .where(eq(workspaceFiles.id, params.id))
        .limit(1)

      if (!file) {
        set.status = 404
        return { message: 'Arquivo não encontrado.' }
      }
      if (file.status !== 'trashed') {
        return { id: file.id, status: file.status }
      }

      // Restaurar pode exceder a quota se o workspace encheu no meio tempo.
      const quotaCheck = await checkFileQuota(file.productSlug, file.workspaceId, file.sizeBytes)
      if (!quotaCheck.ok) {
        set.status = 402
        return { message: quotaCheck.reason }
      }

      await db
        .update(workspaceFiles)
        .set({ status: 'active', trashedAt: null, trashedBy: null, updatedAt: new Date() })
        .where(eq(workspaceFiles.id, file.id))

      return { id: file.id, status: 'active' }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // --- Leitura pública de arquivo (URL que o produto embeda em campanhas) ---

  .get(
    '/files/assets/:id/:filename',
    async ({ params, set }) => {
      const [file] = await db
        .select()
        .from(workspaceFiles)
        .where(and(eq(workspaceFiles.id, params.id), eq(workspaceFiles.status, 'active')))
        .limit(1)

      if (!file) {
        set.status = 404
        return { message: 'Arquivo não encontrado.' }
      }

      const object = await getWorkspaceFile(file.s3Key)
      if (!object) {
        set.status = 404
        return { message: 'Arquivo não encontrado no storage.' }
      }

      const contentType = safeContentType(file.mimeType)
      const disposition = shouldForceDownload(contentType) ? 'attachment' : 'inline'

      set.headers['cache-control'] = 'public, max-age=31536000, immutable'
      set.headers['content-disposition'] = `${disposition}; filename="${file.originalName}"`

      return new Response(object.bytes, {
        headers: { 'content-type': contentType },
      })
    },
    {
      params: t.Object({
        id: t.String(),
        filename: t.String(),
      }),
    },
  )

  // --- Rotas da UI Vianova (sessão cookie) ---

  .get('/files/workspaces', async ({ session, set }) => {
    if (!session) {
      set.status = 401
      return { message: 'Não autenticado.' }
    }

    // Workspaces onde o usuário é dono.
    const owned = await db
      .select({
        subscriptionId: productSubscriptions.id,
        productSlug: productSubscriptions.productSlug,
        workspaceId: productSubscriptions.workspaceId,
        workspaceName: productSubscriptions.workspaceName,
      })
      .from(productSubscriptions)
      .where(eq(productSubscriptions.ownerUserId, session.userId))

    // Workspaces vinculados a organizações do qual o usuário é membro.
    const memberOrgs = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, session.userId))

    const orgIds = memberOrgs.map((m) => m.organizationId)
    const orgSubs =
      orgIds.length > 0
        ? await db
            .select({
              subscriptionId: productSubscriptions.id,
              productSlug: productSubscriptions.productSlug,
              workspaceId: productSubscriptions.workspaceId,
              workspaceName: productSubscriptions.workspaceName,
            })
            .from(productSubscriptions)
            .where(inArray(productSubscriptions.organizationId, orgIds))
        : []

    const map = new Map<string, (typeof owned)[number]>()
    for (const sub of [...owned, ...orgSubs]) {
      const key = `${sub.productSlug}:${sub.workspaceId}`
      if (!map.has(key)) map.set(key, sub)
    }

    const workspaces = await Promise.all(
      Array.from(map.values()).map(async (sub) => {
        const [limits, usage] = await Promise.all([
          getWorkspaceFileLimits(sub.productSlug, sub.workspaceId),
          getWorkspaceFileUsage(sub.productSlug, sub.workspaceId, 'active'),
        ])
        return {
          subscriptionId: sub.subscriptionId,
          productSlug: sub.productSlug,
          workspaceId: sub.workspaceId,
          workspaceName: sub.workspaceName,
          quotaBytes: limits.storageBytes,
          maxFileSizeBytes: limits.maxFileSizeBytes,
          usedBytes: usage.usedBytes,
          fileCount: usage.fileCount,
          percent: limits.storageBytes > 0 ? Math.round((usage.usedBytes / limits.storageBytes) * 100) : 0,
        }
      }),
    )

    return { workspaces: workspaces.sort((a, b) => b.percent - a.percent) }
  })

  .get(
    '/files/workspaces/:productSlug/:workspaceId',
    async ({ session, params, query, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const canView = await canViewWorkspace(session.userId, params.productSlug, params.workspaceId)
      if (!canView) {
        set.status = 403
        return { message: 'Você não tem acesso a este workspace.' }
      }

      const status = query.status === 'trashed' ? 'trashed' : 'active'
      const limit = Math.min(100, Math.max(1, Number(query.limit ?? 50)))
      const cursor = typeof query.cursor === 'string' ? query.cursor : null

      const conditions = and(
        eq(workspaceFiles.productSlug, params.productSlug),
        eq(workspaceFiles.workspaceId, params.workspaceId),
        eq(workspaceFiles.status, status),
        cursor ? sql`${workspaceFiles.id} < ${cursor}` : undefined,
      )

      const [rows, limits, usage] = await Promise.all([
        db
          .select()
          .from(workspaceFiles)
          .where(conditions)
          .orderBy(desc(workspaceFiles.createdAt))
          .limit(limit + 1),
        getWorkspaceFileLimits(params.productSlug, params.workspaceId),
        getWorkspaceFileUsage(params.productSlug, params.workspaceId, 'active'),
      ])

      const hasMore = rows.length > limit
      const items = hasMore ? rows.slice(0, -1) : rows
      const nextCursor = hasMore ? items[items.length - 1]?.id : null

      return {
        productSlug: params.productSlug,
        workspaceId: params.workspaceId,
        quotaBytes: limits.storageBytes,
        maxFileSizeBytes: limits.maxFileSizeBytes,
        usedBytes: usage.usedBytes,
        fileCount: usage.fileCount,
        percent: limits.storageBytes > 0 ? Math.round((usage.usedBytes / limits.storageBytes) * 100) : 0,
        items: items.map((r) => ({
          id: r.id,
          url: `${API_URL}/files/assets/${r.id}/${encodeURIComponent(r.originalName)}`,
          originalName: r.originalName,
          mimeType: r.mimeType,
          sizeBytes: r.sizeBytes,
          status: r.status,
          createdAt: r.createdAt,
          trashedAt: r.trashedAt,
        })),
        nextCursor,
      }
    },
    {
      params: t.Object({
        productSlug: t.String(),
        workspaceId: t.String(),
      }),
      query: t.Object({
        status: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
      }),
    },
  )

  .delete(
    '/files/workspaces/:productSlug/:workspaceId/:fileId',
    async ({ session, params, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const canManage = await canManageWorkspace(session.userId, params.productSlug, params.workspaceId)
      if (!canManage) {
        set.status = 403
        return { message: 'Apenas o dono ou admin do workspace pode gerenciar arquivos.' }
      }

      const [file] = await db
        .select()
        .from(workspaceFiles)
        .where(
          and(
            eq(workspaceFiles.id, params.fileId),
            eq(workspaceFiles.productSlug, params.productSlug),
            eq(workspaceFiles.workspaceId, params.workspaceId),
          ),
        )
        .limit(1)

      if (!file) {
        set.status = 404
        return { message: 'Arquivo não encontrado.' }
      }

      await db
        .update(workspaceFiles)
        .set({ status: 'trashed', trashedAt: new Date(), trashedBy: session.userId, updatedAt: new Date() })
        .where(eq(workspaceFiles.id, file.id))

      return { id: file.id, status: 'trashed' }
    },
    {
      params: t.Object({
        productSlug: t.String(),
        workspaceId: t.String(),
        fileId: t.String(),
      }),
    },
  )

  .post(
    '/files/workspaces/:productSlug/:workspaceId/:fileId/restore',
    async ({ session, params, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const canManage = await canManageWorkspace(session.userId, params.productSlug, params.workspaceId)
      if (!canManage) {
        set.status = 403
        return { message: 'Apenas o dono ou admin do workspace pode gerenciar arquivos.' }
      }

      const [file] = await db
        .select()
        .from(workspaceFiles)
        .where(
          and(
            eq(workspaceFiles.id, params.fileId),
            eq(workspaceFiles.productSlug, params.productSlug),
            eq(workspaceFiles.workspaceId, params.workspaceId),
          ),
        )
        .limit(1)

      if (!file) {
        set.status = 404
        return { message: 'Arquivo não encontrado.' }
      }
      if (file.status !== 'trashed') {
        return { id: file.id, status: file.status }
      }

      const quotaCheck = await checkFileQuota(file.productSlug, file.workspaceId, file.sizeBytes)
      if (!quotaCheck.ok) {
        set.status = 402
        return { message: quotaCheck.reason }
      }

      await db
        .update(workspaceFiles)
        .set({ status: 'active', trashedAt: null, trashedBy: null, updatedAt: new Date() })
        .where(eq(workspaceFiles.id, file.id))

      return { id: file.id, status: 'active' }
    },
    {
      params: t.Object({
        productSlug: t.String(),
        workspaceId: t.String(),
        fileId: t.String(),
      }),
    },
  )
