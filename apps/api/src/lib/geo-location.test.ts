import { describe, expect, spyOn, test } from 'bun:test'
import {
  abbreviateIp,
  formatLoginAlertDescription,
  getIpNetworkKey,
  locateIp,
} from './geo-location'

describe('geo-location', () => {
  test('abrevia IPv6 sem esconder que se trata do mesmo endereço', () => {
    expect(abbreviateIp('2804:108c:c58b:3100:5ecd:5bff:fecb:b6a5')).toBe('2804:108c:…:b6a5')
  })

  test('mantém IPv4 legível', () => {
    expect(abbreviateIp('203.0.113.10')).toBe('203.0.113.10')
  })

  test('agrupa endereços da mesma rede para evitar consultas repetidas', () => {
    expect(getIpNetworkKey('203.0.113.10')).toBe(getIpNetworkKey('203.0.113.240'))
    expect(getIpNetworkKey('2804:108c:c58b:3100:5ecd:5bff:fecb:b6a5')).toBe(
      getIpNetworkKey('2804:108c:c58b:3100:1111:2222:3333:4444'),
    )
  })

  test('não tenta localizar um endereço inválido', async () => {
    expect(await locateIp('desconhecido')).toBeNull()
  })

  test('faz fallback explícito quando a localização está indisponível', () => {
    expect(formatLoginAlertDescription(null, '2804:108c:c58b:3100:5ecd:5bff:fecb:b6a5')).toContain(
      'Localização aproximada indisponível. IP: 2804:108c:…:b6a5.',
    )
  })

  test('trata limite diário como localização indisponível', async () => {
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
