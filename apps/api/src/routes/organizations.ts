import { Elysia, t } from 'elysia'
import { db, organizations, organizationMembers, users } from '@vianova/db'
import { eq, and } from 'drizzle-orm'
import { generateId } from '../lib/crypto'
import { authPlugin } from '../plugins/auth'

async function getMembership(organizationId: string, userId: string) {
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1)
  return member ?? null
}

async function getOrganization(id: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1)
  return org ?? null
}

export const organizationRoutes = new Elysia({ prefix: '/organizations' })
  .use(authPlugin)

  .get('/', async ({ session, set }) => {
    if (!session) {
      set.status = 401
      return { message: 'Não autenticado.' }
    }

    const rows = await db
      .select({ organization: organizations })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, session.userId))

    return { organizations: rows.map((r) => r.organization) }
  })

  .post(
    '/',
    async ({ session, body, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const orgId = generateId()
      const [organization] = await db
        .insert(organizations)
        .values({ id: orgId, name: body.name, ownerUserId: session.userId })
        .returning()

      await db.insert(organizationMembers).values({
        id: generateId(),
        organizationId: orgId,
        userId: session.userId,
      })

      return { organization }
    },
    { body: t.Object({ name: t.String({ minLength: 1 }) }) },
  )

  .get('/:id', async ({ session, params, set }) => {
    if (!session) {
      set.status = 401
      return { message: 'Não autenticado.' }
    }

    const membership = await getMembership(params.id, session.userId)
    if (!membership) {
      set.status = 403
      return { message: 'Acesso negado.' }
    }

    const organization = await getOrganization(params.id)
    if (!organization) {
      set.status = 404
      return { message: 'Organização não encontrada.' }
    }

    const members = await db
      .select({
        id: organizationMembers.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        joinedAt: organizationMembers.createdAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, params.id))

    return { organization, members }
  })

  .patch(
    '/:id',
    async ({ session, params, body, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const organization = await getOrganization(params.id)
      if (!organization) {
        set.status = 404
        return { message: 'Organização não encontrada.' }
      }
      if (organization.ownerUserId !== session.userId) {
        set.status = 403
        return { message: 'Apenas o dono pode editar a organização.' }
      }

      const [updated] = await db
        .update(organizations)
        .set({ name: body.name, updatedAt: new Date() })
        .where(eq(organizations.id, params.id))
        .returning()

      return { organization: updated }
    },
    { body: t.Object({ name: t.String({ minLength: 1 }) }) },
  )

  .delete('/:id', async ({ session, params, set }) => {
    if (!session) {
      set.status = 401
      return { message: 'Não autenticado.' }
    }

    const organization = await getOrganization(params.id)
    if (!organization) {
      set.status = 404
      return { message: 'Organização não encontrada.' }
    }
    if (organization.ownerUserId !== session.userId) {
      set.status = 403
      return { message: 'Apenas o dono pode excluir a organização.' }
    }

    await db.delete(organizations).where(eq(organizations.id, params.id))

    return { message: 'Organização excluída.' }
  })

  .post(
    '/:id/members',
    async ({ session, params, body, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const organization = await getOrganization(params.id)
      if (!organization) {
        set.status = 404
        return { message: 'Organização não encontrada.' }
      }
      if (organization.ownerUserId !== session.userId) {
        set.status = 403
        return { message: 'Apenas o dono pode adicionar membros.' }
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email.toLowerCase()))
        .limit(1)

      if (!user) {
        set.status = 404
        return { message: 'Nenhuma conta Vianova com este email. A pessoa precisa criar a conta primeiro.' }
      }

      const existing = await getMembership(params.id, user.id)
      if (existing) {
        set.status = 409
        return { message: 'Esta pessoa já é membro da organização.' }
      }

      await db.insert(organizationMembers).values({
        id: generateId(),
        organizationId: params.id,
        userId: user.id,
      })

      return { message: 'Membro adicionado.' }
    },
    { body: t.Object({ email: t.String({ format: 'email' }) }) },
  )

  .delete('/:id/members/:userId', async ({ session, params, set }) => {
    if (!session) {
      set.status = 401
      return { message: 'Não autenticado.' }
    }

    const organization = await getOrganization(params.id)
    if (!organization) {
      set.status = 404
      return { message: 'Organização não encontrada.' }
    }
    if (organization.ownerUserId !== session.userId) {
      set.status = 403
      return { message: 'Apenas o dono pode remover membros.' }
    }
    if (params.userId === organization.ownerUserId) {
      set.status = 400
      return { message: 'O dono não pode ser removido da organização.' }
    }

    await db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, params.id),
          eq(organizationMembers.userId, params.userId),
        ),
      )

    return { message: 'Membro removido.' }
  })
