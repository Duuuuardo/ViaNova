import { and, eq, gte, lte, sql, not } from 'drizzle-orm'
import { db, productSubscriptions, productPlans, productCatalog, notifications, users } from '@vianova/db'
import { sendUpcomingRenewalEmail } from './email'
import { notifyUser } from './notifications'
import { requireEnv } from './env'

const WEB_URL = requireEnv('VIANOVA_WEB_URL')

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

async function getProductName(productSlug: string): Promise<string> {
  const [product] = await db.select({ name: productCatalog.name }).from(productCatalog).where(eq(productCatalog.slug, productSlug)).limit(1)
  return product?.name ?? productSlug
}

async function findReminders(daysLeft: number) {
  const start = daysFromNow(daysLeft)
  const end = endOfDay(start)

  const rows = await db
    .select({
      subscription: productSubscriptions,
      plan: productPlans,
    })
    .from(productSubscriptions)
    .leftJoin(productPlans, eq(productSubscriptions.planId, productPlans.id))
    .where(
      and(
        eq(productSubscriptions.status, 'active'),
        not(eq(productSubscriptions.cancelAtPeriodEnd, true)),
        sql`${productSubscriptions.stripeSubscriptionId} is not null and ${productSubscriptions.stripeSubscriptionId} <> ''`,
        gte(productSubscriptions.currentPeriodEnd, start),
        lte(productSubscriptions.currentPeriodEnd, end),
        sql`not exists (
          select 1 from ${notifications}
          where ${notifications.userId} = ${productSubscriptions.ownerUserId}
            and ${notifications.type} = 'billing'
            and ${notifications.source} = 'vianova'
            and ${notifications.sourceProductSlug} = ${productSubscriptions.productSlug}
            and ${notifications.sourceWorkspaceId} = ${productSubscriptions.workspaceId}
            and ${notifications.metadata}->>'reminderDaysLeft' = ${String(daysLeft)}
            and ${notifications.createdAt} >= now() - interval '30 days'
        )`,
      ),
    )

  return rows
}

async function sendReminder(row: { subscription: typeof productSubscriptions.$inferSelect; plan: typeof productPlans.$inferSelect | null }) {
  const sub = row.subscription
  const plan = row.plan
  if (!sub.ownerUserId || !sub.currentPeriodEnd) return

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, sub.ownerUserId))
    .limit(1)

  if (!user) return

  const productName = await getProductName(sub.productSlug)
  const planName = plan?.name ?? 'atual'
  const daysLeft = Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  try {
    await notifyUser({
      userId: user.id,
      type: 'billing',
      source: 'vianova',
      sourceProductSlug: sub.productSlug,
      sourceWorkspaceId: sub.workspaceId,
      sourceWorkspaceName: sub.workspaceName,
      title: 'Sua assinatura renova em breve',
      body: `O plano ${planName} do ${productName} renova automaticamente em ${daysLeft} dia${daysLeft === 1 ? '' : 's'} (${sub.currentPeriodEnd.toLocaleDateString('pt-BR')}). Certifique-se de que sua forma de pagamento está atualizada.`,
      actionUrl: `${WEB_URL}/billing`,
      actionLabel: 'Gerenciar pagamento',
      metadata: { reminderDaysLeft: daysLeft, planName, periodEnd: sub.currentPeriodEnd.toISOString() },
      email: {
        to: user.email,
        name: user.name,
        send: (email, name) => sendUpcomingRenewalEmail(email, name, productName, planName, sub.currentPeriodEnd!, daysLeft),
      },
    })
  } catch (err) {
    console.error(`[billing:reminder] falha ao enviar lembrete para ${sub.id}:`, err)
  }
}

export async function sendRenewalReminders() {
  for (const days of [7, 1]) {
    const rows = await findReminders(days)
    for (const row of rows) {
      await sendReminder(row)
    }
  }
}
