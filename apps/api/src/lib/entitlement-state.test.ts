import { describe, expect, it } from 'bun:test'
import { resolveEntitlementAccess } from './entitlement-state'

const now = new Date('2026-07-22T12:00:00.000Z')

describe('resolveEntitlementAccess', () => {
  it.each(['active', 'trialing', 'past_due'])('mantém acesso para status %s', (status) => {
    expect(resolveEntitlementAccess({ status, cancelAtPeriodEnd: false, currentPeriodEnd: null }, true, now)).toEqual({
      entitled: true,
      productStatus: 'active',
    })
  })

  it('mantém o plano durante um cancelamento agendado', () => {
    expect(resolveEntitlementAccess({
      status: 'canceled',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date('2026-08-01T12:00:00.000Z'),
    }, true, now)).toEqual({ entitled: true, productStatus: 'active' })
  })

  it('encerra o acesso depois do período agendado', () => {
    expect(resolveEntitlementAccess({
      status: 'canceled',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date('2026-07-20T12:00:00.000Z'),
    }, true, now)).toEqual({ entitled: false, productStatus: 'canceled' })
  })

  it('não concede acesso sem plano associado', () => {
    expect(resolveEntitlementAccess({ status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: null }, false, now)).toEqual({
      entitled: false,
      productStatus: 'active',
    })
  })
})
