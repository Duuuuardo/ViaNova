import { describe, expect, test } from 'bun:test'
import { encodeCursor, decodeCursor } from './pagination'

describe('pagination cursor', () => {
  test('round-trips a (createdAt, id) pair', () => {
    const createdAt = '2026-01-15 10:30:45.123456+00'
    const id = '7f4c9a2e-1b3d-4e5f-8a9c-0d1e2f3a4b5c'
    expect(decodeCursor(encodeCursor(createdAt, id))).toEqual({ createdAt, id })
  })

  test('preserves sub-millisecond timestamp text verbatim', () => {
    const cursor = decodeCursor(encodeCursor('2026-01-15 10:30:45.123456+00', 'x'))
    expect(cursor?.createdAt).toBe('2026-01-15 10:30:45.123456+00')
  })

  test('rejects malformed cursors', () => {
    expect(decodeCursor('')).toBeNull()
    expect(decodeCursor('_')).toBeNull()
    expect(decodeCursor('not-a-date_abc')).toBeNull()
    expect(decodeCursor('2026-01-01T00:00:00.000Z_')).toBeNull()
    expect(decodeCursor('abc123')).toBeNull()
  })
})
