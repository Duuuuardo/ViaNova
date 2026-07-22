import { Elysia, t } from 'elysia'
import { db, users, emailVerifications, passwordResets, totpSecrets, sessions } from '@vianova/db'
import { eq, and, gt, isNull, ne } from 'drizzle-orm'
import { generateId, generateToken, hashToken, generateBackupCodes } from '../lib/crypto'
import { createSession, deleteSession, deleteAllUserSessions, SESSION_COOKIE, createLoginChallenge, validateLoginChallenge } from '../lib/session'
import { sendVerificationEmail, sendPasswordResetEmail, sendSecurityAlertEmail } from '../lib/email'
import { generateTotpSecret, getTotpUri, verifyTotp } from '../lib/totp'
import { enqueue } from '../lib/queue'
import { notifyUser } from '../lib/notifications'
import { authPlugin } from '../plugins/auth'
import { checkPasswordPolicy } from '../lib/password-policy'
import { getCookieOptions, requireEnv, getClientIp } from '../lib/env'

const WEB_URL = requireEnv('VIANOVA_WEB_URL')

async function securityNotify(
  userId: string,
  title: string,
  description: string,
  metadata?: Record<string, unknown>,
) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return
  try {
    await notifyUser({
      userId: user.id,
      type: 'security',
      source: 'vianova',
      title,
      body: description,
      actionUrl: `${WEB_URL}/security`,
      actionLabel: 'Ver segurança da conta',
      metadata: metadata ?? {},
      email: {
        to: user.email,
        name: user.name,
        send: (email, name) => sendSecurityAlertEmail(email, name, title, description),
      },
    })
  } catch (err) {
    console.error('[security:notify]', err)
  }
}

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authPlugin)

  .post(
    '/register',
    async ({ body, set, cookie, request }) => {
      const { name, email, password } = body

      const policyError = checkPasswordPolicy(password)
      if (policyError) {
        set.status = 400
        return { message: policyError }
      }

      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1)

      if (existing.length > 0) {
        set.status = 409
        return { message: 'Este email já está em uso.' }
      }

      const passwordHash = await Bun.password.hash(password, 'argon2id')
      const userId = generateId()

      await db.insert(users).values({
        id: userId,
        email: email.toLowerCase(),
        passwordHash,
        name,
      })

      const token = generateToken()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await db.insert(emailVerifications).values({
        id: generateId(),
        userId,
        tokenHash: hashToken(token),
        expiresAt,
      })

      const verifyUrl = `${process.env.VIANOVA_WEB_URL}/verify-email?token=${token}`
      await sendVerificationEmail(email, name, verifyUrl)

      // A conta nasce logada — a verificação de email não bloqueia o acesso,
      // só mantém o aviso na interface até o link ser confirmado.
      const ip = getClientIp(request)
      const userAgent = request.headers.get('user-agent') ?? undefined
      const { token: sessionToken } = await createSession(userId, ip, userAgent)

      cookie[SESSION_COOKIE].set({
        value: sessionToken,
        ...getCookieOptions(),
        maxAge: 60 * 60 * 24 * 30,
      })

      return {
        user: {
          id: userId,
          name,
          email: email.toLowerCase(),
          avatarUrl: null,
          avatarFrame: 'none',
          twoFactorEnabled: false,
        },
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 200 }),
        email: t.String({ format: 'email', maxLength: 254 }),
        password: t.String({ minLength: 8, maxLength: 128 }),
      }),
    },
  )

  .post(
    '/login',
    async ({ body, set, cookie, request }) => {
      const { email, password, totpCode, challengeToken } = body
      const ip = getClientIp(request)
      const userAgent = request.headers.get('user-agent') ?? undefined

      let userId: string
      let userPasswordHash: string | null
      let userTwoFactorEnabled: boolean

      if (challengeToken) {
        const challenge = await validateLoginChallenge(challengeToken)
        if (!challenge) {
          set.status = 401
          return { message: 'Sessão de verificação expirada. Faça login novamente.' }
        }
        userId = challenge.userId

        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
        if (!user) {
          set.status = 401
          return { message: 'Sessão de verificação inválida.' }
        }
        userPasswordHash = user.passwordHash
        userTwoFactorEnabled = user.twoFactorEnabled
      } else {
        if (!email || !password) {
          set.status = 400
          return { message: 'Email e senha são obrigatórios.' }
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1)

        if (!user || !user.passwordHash) {
          set.status = 401
          return { message: 'Credenciais inválidas.' }
        }

        const valid = await Bun.password.verify(password, user.passwordHash)
        if (!valid) {
          set.status = 401
          return { message: 'Credenciais inválidas.' }
        }

        userId = user.id
        userPasswordHash = user.passwordHash
        userTwoFactorEnabled = user.twoFactorEnabled

        if (user.twoFactorEnabled) {
          const { token: challengeToken } = await createLoginChallenge(user.id, ip, userAgent)
          return { requires2FA: true as const, challengeToken }
        }
      }

      if (userTwoFactorEnabled) {
        if (!totpCode) {
          set.status = 400
          return { message: 'Código de verificação em duas etapas é obrigatório.' }
        }

        const [totpRow] = await db
          .select()
          .from(totpSecrets)
          .where(eq(totpSecrets.userId, userId))
          .limit(1)

        if (!totpRow || !totpRow.verifiedAt) {
          set.status = 401
          return { message: 'Código inválido.' }
        }

        const totpValid = verifyTotp(totpCode, totpRow.secret)

        if (!totpValid) {
          const backupCodes = totpRow.backupCodes ?? []
          const codeHash = hashToken(totpCode.toUpperCase())
          const backupIndex = backupCodes.indexOf(codeHash)

          if (backupIndex === -1) {
            set.status = 401
            return { message: 'Código inválido.' }
          }

          const updatedCodes = [...backupCodes]
          updatedCodes.splice(backupIndex, 1)
          await db
            .update(totpSecrets)
            .set({ backupCodes: updatedCodes })
            .where(eq(totpSecrets.userId, userId))
        }
      }

      const { token } = await createSession(userId, ip, userAgent)

      cookie[SESSION_COOKIE].set({
        value: token,
        ...getCookieOptions(),
        maxAge: 60 * 60 * 24 * 30,
      })

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

      // Notifica o usuário sobre o novo acesso, mas não bloqueia o login.
      securityNotify(
        userId,
        'Novo acesso à sua conta',
        `Detectamos um novo login no seu endereço ${ip ?? 'desconhecido'}. Se não foi você, altere sua senha imediatamente.`,
        { ip, userAgent },
      ).catch(() => {})

      return {
        user: {
          id: userId,
          name: user?.name ?? '',
          email: user?.email ?? '',
          avatarUrl: user?.avatarUrl ?? null,
          avatarFrame: user?.avatarFrame ?? 'none',
          twoFactorEnabled: userTwoFactorEnabled,
        },
      }
    },
    {
      body: t.Object({
        email: t.Optional(t.String({ format: 'email', maxLength: 254 })),
        // Sem policy aqui: senhas antigas continuam válidas no login; o teto só barra payload abusivo.
        password: t.Optional(t.String({ maxLength: 512 })),
        totpCode: t.Optional(t.String({ maxLength: 64 })),
        challengeToken: t.Optional(t.String({ maxLength: 512 })),
      }),
    },
  )

  .post('/logout', async ({ session, set, cookie }) => {
    if (!session) {
      set.status = 401
      return { message: 'Não autenticado.' }
    }

    const token = cookie[SESSION_COOKIE]?.value as string | undefined
    if (token) {
      const deletedSessionId = await deleteSession(token)
      // Single sign-out imediato: derruba a sessão nos produtos via webhook de
      // revogação; a introspection também passa a responder active: false.
      if (deletedSessionId) {
        await enqueue({
          type: 'session:revoked',
          userId: session.userId,
          sessionIds: [deletedSessionId],
        })
      }
    }

    cookie[SESSION_COOKIE].set({ value: '', maxAge: 0, path: '/' })

    return { message: 'Sessão encerrada.' }
  })

  .get('/me', async ({ session, set }) => {
    if (!session) {
      set.status = 401
      return { message: 'Não autenticado.' }
    }

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        avatarFrame: users.avatarFrame,
        phone: users.phone,
        jobTitle: users.jobTitle,
        department: users.department,
        location: users.location,
        timezone: users.timezone,
        locale: users.locale,
        twoFactorEnabled: users.twoFactorEnabled,
        emailVerifiedAt: users.emailVerifiedAt,
        scheduledForDeletionAt: users.scheduledForDeletionAt,
        status: users.status,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1)

    if (!user) {
      set.status = 404
      return { message: 'Usuário não encontrado.' }
    }

    return { user }
  })

  .patch(
    '/profile',
    async ({ session, body, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const [user] = await db
        .update(users)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.avatarFrame !== undefined ? { avatarFrame: body.avatarFrame } : {}),
          ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
          ...(body.jobTitle !== undefined ? { jobTitle: body.jobTitle || null } : {}),
          ...(body.department !== undefined ? { department: body.department || null } : {}),
          ...(body.location !== undefined ? { location: body.location || null } : {}),
          ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
          ...(body.locale !== undefined ? { locale: body.locale } : {}),
          ...(body.preferences !== undefined ? { preferences: body.preferences } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, session.userId))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
          avatarFrame: users.avatarFrame,
          phone: users.phone,
          jobTitle: users.jobTitle,
          department: users.department,
          location: users.location,
          timezone: users.timezone,
          locale: users.locale,
          preferences: users.preferences,
          twoFactorEnabled: users.twoFactorEnabled,
          scheduledForDeletionAt: users.scheduledForDeletionAt,
          status: users.status,
        })

      return { user }
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        // Foto entra só via POST /account/avatar (MinIO) — aqui só a moldura.
        avatarFrame: t.Optional(
          t.Union([t.Literal('none'), t.Literal('via'), t.Literal('gradient')]),
        ),
        phone: t.Optional(t.String()),
        jobTitle: t.Optional(t.String()),
        department: t.Optional(t.String()),
        location: t.Optional(t.String()),
        timezone: t.Optional(t.String()),
        locale: t.Optional(t.String()),
        preferences: t.Optional(
          t.Object({
            theme: t.Optional(t.Union([t.Literal('system'), t.Literal('light'), t.Literal('dark')])),
            reducedMotion: t.Optional(t.Boolean()),
            billingAlerts: t.Optional(t.Boolean()),
            securityAlerts: t.Optional(t.Boolean()),
            marketingEmails: t.Optional(t.Boolean()),
          })
        ),
      }),
    },
  )

  .post(
    '/verify-email',
    async ({ body, set }) => {
      const tokenHash = hashToken(body.token)
      const now = new Date()

      const [verification] = await db
        .select()
        .from(emailVerifications)
        .where(and(eq(emailVerifications.tokenHash, tokenHash), gt(emailVerifications.expiresAt, now)))
        .limit(1)

      if (!verification) {
        set.status = 400
        return { message: 'Token inválido ou expirado.' }
      }

      await db.update(users).set({ emailVerifiedAt: now }).where(eq(users.id, verification.userId))
      await db.delete(emailVerifications).where(eq(emailVerifications.id, verification.id))

      return { message: 'Email confirmado com sucesso.' }
    },
    { body: t.Object({ token: t.String() }) },
  )

  .post(
    '/resend-verification',
    async ({ body, set }) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email.toLowerCase()))
        .limit(1)

      if (!user) {
        return { message: 'Se o email existir, você receberá as instruções.' }
      }

      if (user.emailVerifiedAt) {
        set.status = 400
        return { message: 'Email já verificado.' }
      }

      // Rate limit: 60s entre reenvios
      const [recent] = await db
        .select()
        .from(emailVerifications)
        .where(
          and(
            eq(emailVerifications.userId, user.id),
            gt(emailVerifications.createdAt, new Date(Date.now() - 60 * 1000)),
          ),
        )
        .limit(1)

      if (!recent) {
        await db.delete(emailVerifications).where(eq(emailVerifications.userId, user.id))

        const token = generateToken()
        await db.insert(emailVerifications).values({
          id: generateId(),
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })

        const verifyUrl = `${process.env.VIANOVA_WEB_URL}/verify-email?token=${token}`
        await sendVerificationEmail(user.email, user.name, verifyUrl)
      }

      return { message: 'Se o email existir, você receberá as instruções.' }
    },
    { body: t.Object({ email: t.String({ format: 'email' }) }) },
  )

  .post(
    '/forgot-password',
    async ({ body }) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email.toLowerCase()))
        .limit(1)

      if (user) {
        const token = generateToken()
        await db.insert(passwordResets).values({
          id: generateId(),
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        })

        const resetUrl = `${process.env.VIANOVA_WEB_URL}/reset-password?token=${token}`
        await sendPasswordResetEmail(user.email, user.name, resetUrl)
      }

      return { message: 'Se o email existir, você receberá as instruções.' }
    },
    { body: t.Object({ email: t.String({ format: 'email' }) }) },
  )

  .post(
    '/reset-password',
    async ({ body, set }) => {
      const policyError = checkPasswordPolicy(body.password)
      if (policyError) {
        set.status = 400
        return { message: policyError }
      }

      const tokenHash = hashToken(body.token)
      const now = new Date()

      const [reset] = await db
        .select()
        .from(passwordResets)
        .where(
          and(
            eq(passwordResets.tokenHash, tokenHash),
            isNull(passwordResets.usedAt),
            gt(passwordResets.expiresAt, now),
          ),
        )
        .limit(1)

      if (!reset) {
        set.status = 400
        return { message: 'Token inválido ou expirado.' }
      }

      const passwordHash = await Bun.password.hash(body.password, 'argon2id')

      await db.update(users).set({ passwordHash }).where(eq(users.id, reset.userId))
      await db.update(passwordResets).set({ usedAt: now }).where(eq(passwordResets.id, reset.id))

      const revokedSessionIds = await deleteAllUserSessions(reset.userId)
      if (revokedSessionIds.length > 0) {
        await enqueue({ type: 'session:revoked', userId: reset.userId, sessionIds: revokedSessionIds })
      }

      await securityNotify(reset.userId, 'Senha redefinida', 'A senha da sua conta Vianova foi redefinida por meio do link de recuperação. Todas as sessões ativas foram encerradas.')

      return { message: 'Senha alterada com sucesso.' }
    },
    {
      body: t.Object({
        token: t.String(),
        password: t.String({ minLength: 8, maxLength: 128 }),
      }),
    },
  )

  .post('/2fa/setup', async ({ session, set }) => {
    if (!session) {
      set.status = 401
      return { message: 'Não autenticado.' }
    }

    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)

    if (!user) {
      set.status = 404
      return { message: 'Usuário não encontrado.' }
    }

    if (!user.emailVerifiedAt) {
      set.status = 403
      return { message: 'Confirme seu email antes de ativar a verificação em duas etapas.' }
    }

    if (user.twoFactorEnabled) {
      set.status = 400
      return { message: '2FA já está ativo.' }
    }

    const secret = generateTotpSecret()

    await db
      .delete(totpSecrets)
      .where(and(eq(totpSecrets.userId, user.id), isNull(totpSecrets.verifiedAt)))

    await db.insert(totpSecrets).values({
      id: generateId(),
      userId: user.id,
      secret,
      verifiedAt: null,
    })

    return { uri: getTotpUri(user.email, secret), secret }
  })

  .post(
    '/2fa/enable',
    async ({ session, body, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const [totpRow] = await db
        .select()
        .from(totpSecrets)
        .where(and(eq(totpSecrets.userId, session.userId), isNull(totpSecrets.verifiedAt)))
        .limit(1)

      if (!totpRow) {
        set.status = 400
        return { message: 'Nenhum setup de 2FA encontrado. Inicie o setup novamente.' }
      }

      if (!verifyTotp(body.code, totpRow.secret)) {
        set.status = 400
        return { message: 'Código inválido.' }
      }

      const plainBackupCodes = generateBackupCodes()

      await db
        .update(totpSecrets)
        .set({ verifiedAt: new Date(), backupCodes: plainBackupCodes.map((c) => hashToken(c)) })
        .where(eq(totpSecrets.id, totpRow.id))

      await db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, session.userId))

      await securityNotify(session.userId, 'Verificação em duas etapas ativada', 'A autenticação em duas etapas (2FA) foi ativada na sua conta. Guarde os códigos de recuperação em um local seguro.')

      return { backupCodes: plainBackupCodes }
    },
    { body: t.Object({ code: t.String() }) },
  )

  .post(
    '/2fa/disable',
    async ({ session, body, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const [totpRow] = await db
        .select()
        .from(totpSecrets)
        .where(eq(totpSecrets.userId, session.userId))
        .limit(1)

      if (!totpRow || !totpRow.verifiedAt) {
        set.status = 400
        return { message: '2FA não está ativo.' }
      }

      if (!verifyTotp(body.code, totpRow.secret)) {
        const backupCodes = totpRow.backupCodes ?? []
        if (!backupCodes.includes(hashToken(body.code.toUpperCase()))) {
          set.status = 401
          return { message: 'Código inválido.' }
        }
      }

      await db.delete(totpSecrets).where(eq(totpSecrets.userId, session.userId))
      await db.update(users).set({ twoFactorEnabled: false }).where(eq(users.id, session.userId))

      await securityNotify(session.userId, 'Verificação em duas etapas desativada', 'A autenticação em duas etapas (2FA) foi desativada na sua conta. Recomendamos mantê-la ativa para maior segurança.')

      return { message: '2FA desativado.' }
    },
    { body: t.Object({ code: t.String() }) },
  )

  .post(
    '/change-password',
    async ({ session, body, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
      if (!user || !user.passwordHash) {
        set.status = 400
        return { message: 'Conta sem senha configurada.' }
      }

      const valid = await Bun.password.verify(body.currentPassword, user.passwordHash)
      if (!valid) {
        set.status = 400
        return { message: 'A senha atual está incorreta.' }
      }

      const policyError = checkPasswordPolicy(body.newPassword)
      if (policyError) {
        set.status = 400
        return { message: policyError }
      }

      if (body.newPassword === body.currentPassword) {
        set.status = 400
        return { message: 'A nova senha deve ser diferente da atual.' }
      }

      const passwordHash = await Bun.password.hash(body.newPassword, 'argon2id')
      await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, session.userId))

      await securityNotify(session.userId, 'Senha alterada', 'A senha da sua conta Vianova foi alterada. Se não foi você, entre em contato com o suporte.')

      return { message: 'Senha alterada com sucesso.' }
    },
    {
      body: t.Object({
        currentPassword: t.String({ maxLength: 512 }),
        newPassword: t.String({ minLength: 8, maxLength: 128 }),
      }),
    },
  )

  .get('/sessions', async ({ session, set }) => {
    if (!session) {
      set.status = 401
      return { message: 'Não autenticado.' }
    }

    const rows = await db
      .select({
        id: sessions.id,
        ip: sessions.ip,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(eq(sessions.userId, session.userId))

    const formattedSessions = rows.map((s) => ({
      ...s,
      isCurrent: s.id === session.sessionId,
    }))

    return { sessions: formattedSessions }
  })

  .post('/sessions/revoke-all', async ({ session, set }) => {
    if (!session) {
      set.status = 401
      return { message: 'Não autenticado.' }
    }

    await db
      .delete(sessions)
      .where(and(eq(sessions.userId, session.userId), ne(sessions.id, session.sessionId)))

    return { message: 'Todas as outras sessões foram encerradas.' }
  })

  .delete(
    '/sessions/:id',
    async ({ session, params, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      if (params.id === session.sessionId) {
        set.status = 400
        return { message: 'Não é possível encerrar sua sessão atual por este botão.' }
      }

      await db
        .delete(sessions)
        .where(and(eq(sessions.id, params.id), eq(sessions.userId, session.userId)))

      return { message: 'Sessão encerrada com sucesso.' }
    },
    { params: t.Object({ id: t.String() }) }
  )

  .post(
    '/delete-account',
    async ({ session, body, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
      if (!user) {
        set.status = 404
        return { message: 'Usuário não encontrado.' }
      }

      if (body.password && user.passwordHash) {
        const valid = await Bun.password.verify(body.password, user.passwordHash)
        if (!valid) {
          set.status = 400
          return { message: 'Senha incorreta.' }
        }
      }

      const scheduledDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
      await db
        .update(users)
        .set({ scheduledForDeletionAt: scheduledDate, status: 'pending_deletion', updatedAt: new Date() })
        .where(eq(users.id, session.userId))

      return { scheduledForDeletionAt: scheduledDate, message: 'Conta agendada para exclusão em 15 dias.' }
    },
    {
      body: t.Object({
        password: t.Optional(t.String()),
      }),
    },
  )

  .post('/cancel-delete-account', async ({ session, set }) => {
    if (!session) {
      set.status = 401
      return { message: 'Não autenticado.' }
    }

    await db
      .update(users)
      .set({ scheduledForDeletionAt: null, status: 'active', updatedAt: new Date() })
      .where(eq(users.id, session.userId))

    return { message: 'Agendamento de exclusão cancelado. Conta reativada.' }
  })
