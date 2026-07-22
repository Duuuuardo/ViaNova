const ENTITLED_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due'])

export type SubscriptionEntitlementState = {
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: Date | null
}

/**
 * Decide se o plano comprado ainda deve valer no produto.
 *
 * Um cancelamento agendado não encerra o período já pago. Mesmo que um evento
 * intermediário espelhe outro status, `cancelAtPeriodEnd` + uma data futura
 * preservam o plano até o webhook de encerramento efetivo migrar a assinatura
 * para o plano grátis.
 */
export function resolveEntitlementAccess(
  subscription: SubscriptionEntitlementState,
  hasPlan: boolean,
  now = new Date(),
): { entitled: boolean; productStatus: string } {
  const scheduledUntilFuture = Boolean(
    subscription.cancelAtPeriodEnd &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd.getTime() > now.getTime(),
  )
  const entitled = hasPlan && (
    ENTITLED_SUBSCRIPTION_STATUSES.has(subscription.status) || scheduledUntilFuture
  )

  return {
    entitled,
    // Os produtos usam status=active como gate. Enquanto o período pago ainda
    // vale, o estado de cobrança do Stripe não deve desligar o produto.
    productStatus: entitled ? 'active' : subscription.status,
  }
}
