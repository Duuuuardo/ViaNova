import { describe, expect, it } from 'bun:test'
import { resolveEntitlementAccess } from './entitlement-state'

const now = new Date('2026-07-22T12:00:00.000Z')

describe('resolveEntitlementAccess', () => {
  it.each(['active', 'trialing', 'past_due'])('grants access for status %s', (status) => {
    expect(resolveEntitlementAccess({ status, cancelAtPeriodEnd: false, currentPeriodEnd: null }, true, now)).toEqual({
      entitled: true,
      productStatus: 'active',
    })
  })

  it('keeps the plan during a scheduled cancellation', () => {
    expect(resolveEntitlementAccess({
      status: 'canceled',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date('2026-08-01T12:00:00.000Z'),
    }, true, now)).toEqual({ entitled: true, productStatus: 'active' })
  })

  it('ends access after the scheduled period', () => {
    expect(resolveEntitlementAccess({
      status: 'canceled',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date('2026-07-20T12:00:00.000Z'),
    }, true, now)).toEqual({ entitled: false, productStatus: 'canceled' })
  })

  it('denies access without an associated plan', () => {
    expect(resolveEntitlementAccess({ status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: null }, false, now)).toEqual({
      entitled: false,
      productStatus: 'active',
    })
  })
})
