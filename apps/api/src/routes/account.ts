import { Elysia, t } from 'elysia'
import { db, users } from '@vianova/db'
import { eq } from 'drizzle-orm'
import { authPlugin } from '../plugins/auth'
import {
  AVATAR_MAX_BYTES,
  avatarExtension,
  deleteAvatar,
  getAvatar,
  putAvatar,
} from '../lib/storage'

const API_URL = process.env.VIANOVA_API_URL ?? 'http://localhost:5000'

export const accountRoutes = new Elysia()
  .use(authPlugin)

  // Upload do avatar da conta. A imagem vai pro MinIO do Vianova; o user
  // guarda só a URL pública proxied pela API (vira o claim `picture`).
  .post(
    '/account/avatar',
    async ({ session, body, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const ext = avatarExtension(body.file.type)
      if (!ext) {
        set.status = 422
        return { message: 'Formato inválido. Envie PNG, JPEG ou WebP.' }
      }
      if (body.file.size > AVATAR_MAX_BYTES) {
        set.status = 422
        return { message: 'Arquivo muito grande. O limite é 2 MB.' }
      }

      const [current] = await db
        .select({ avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1)

      const name = `${session.userId}-${Date.now()}.${ext}`
      await putAvatar(name, body.file)

      const avatarUrl = `${API_URL}/files/avatars/${name}`
      const [user] = await db
        .update(users)
        .set({ avatarUrl, updatedAt: new Date() })
        .where(eq(users.id, session.userId))
        .returning({
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
          avatarFrame: users.avatarFrame,
        })

      // Limpa a foto anterior depois da troca — falha aqui não afeta o upload.
      const previous = current?.avatarUrl?.split('/files/avatars/')[1]
      if (previous) await deleteAvatar(previous)

      return { user }
    },
    {
      body: t.Object({
        file: t.File(),
      }),
    },
  )

  // Leitura pública do avatar — o browser (de qualquer produto) busca aqui;
  // a credencial S3 nunca sai da API.
  .get('/files/avatars/:name', async ({ params, set }) => {
    const found = await getAvatar(params.name)
    if (!found) {
      set.status = 404
      return { message: 'Arquivo não encontrado.' }
    }
    set.headers['cache-control'] = 'public, max-age=31536000, immutable'
    return new Response(found.bytes, { headers: { 'content-type': found.type } })
  })
