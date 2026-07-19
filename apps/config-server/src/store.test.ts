import { describe, it, expect } from 'bun:test'
import { deepMerge, type ConfigMap } from './store'

describe('deepMerge', () => {
  it('returns base when override is empty', () => {
    const base: ConfigMap = { app: { name: 'Vianova' } }
    expect(deepMerge(base, {})).toEqual(base)
  })

  it('overrides scalar values', () => {
    const base: ConfigMap = { app: { name: 'Vianova', url: 'https://vianova.software' } }
    const override: ConfigMap = { app: { url: 'http://localhost:3000' } }
    expect(deepMerge(base, override)).toEqual({
      app: { name: 'Vianova', url: 'http://localhost:3000' },
    })
  })

  it('recursively merges nested objects', () => {
    const base: ConfigMap = {
      app: { name: 'Naia', url: 'https://naia.website' },
      features: { campaigns: true, crm: false },
    }
    const override: ConfigMap = {
      app: { url: 'http://localhost:3301' },
      email: { fromName: 'Naia' },
    }
    expect(deepMerge(base, override)).toEqual({
      app: { name: 'Naia', url: 'http://localhost:3301' },
      features: { campaigns: true, crm: false },
      email: { fromName: 'Naia' },
    })
  })

  it('replaces arrays instead of merging', () => {
    const base: ConfigMap = { list: [1, 2] }
    const override: ConfigMap = { list: [3] }
    expect(deepMerge(base, override)).toEqual({ list: [3] })
  })

  it('does not mutate inputs', () => {
    const base: ConfigMap = { a: { b: 1 } }
    const override: ConfigMap = { a: { c: 2 } }
    const result = deepMerge(base, override)
    expect(base).toEqual({ a: { b: 1 } })
    expect(override).toEqual({ a: { c: 2 } })
    expect(result).toEqual({ a: { b: 1, c: 2 } })
  })
})
