const ENTITLED_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due'])

export type SubscriptionEntitlementState = {
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: Date | null
}

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
    productStatus: entitled ? 'active' : subscription.status,
  }
}
