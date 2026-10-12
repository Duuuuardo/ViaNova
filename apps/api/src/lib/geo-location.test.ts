import { describe, expect, spyOn, test } from 'bun:test'
import {
  abbreviateIp,
  formatLoginAlertDescription,
  getIpNetworkKey,
  locateIp,
} from './geo-location'

describe('geo-location', () => {
  test('abbreviates IPv6 without hiding that it is the same address', () => {
    expect(abbreviateIp('2804:108c:c58b:3100:5ecd:5bff:fecb:b6a5')).toBe('2804:108c:…:b6a5')
  })

  test('keeps IPv4 readable', () => {
    expect(abbreviateIp('203.0.113.10')).toBe('203.0.113.10')
  })

  test('groups addresses on the same network to avoid repeated lookups', () => {
    expect(getIpNetworkKey('203.0.113.10')).toBe(getIpNetworkKey('203.0.113.240'))
    expect(getIpNetworkKey('2804:108c:c58b:3100:5ecd:5bff:fecb:b6a5')).toBe(
      getIpNetworkKey('2804:108c:c58b:3100:1111:2222:3333:4444'),
    )
  })

  test('does not try to locate an invalid address', async () => {
    expect(await locateIp('desconhecido')).toBeNull()
  })

  test('falls back explicitly when location is unavailable', () => {
    expect(formatLoginAlertDescription(null, '2804:108c:c58b:3100:5ecd:5bff:fecb:b6a5')).toContain(
      'Localização aproximada indisponível. IP: 2804:108c:…:b6a5.',
    )
  })

  test('treats the daily limit as an unavailable location', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ success: false, message: 'Rate limit exceeded' }),
      { status: 429 },
    ))
    try {
      expect(await locateIp('203.0.113.10')).toBeNull()
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
