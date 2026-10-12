export function parseApiError(value: unknown, fallback: string): string {
  const val = value as any
  const msg: unknown = val?.message
  if (!msg || typeof msg !== 'string') return fallback
  if (msg.trimStart().startsWith('{')) return fallback
  return msg
}
