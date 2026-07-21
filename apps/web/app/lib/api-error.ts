/**
 * Extrai mensagem legível de um erro da Eden Treaty.
 * Elysia validation errors chegam como value.message = '{"type":"validation",...}'
 * — nesses casos retorna o fallback para não expor JSON bruto ao usuário.
 */
export function parseApiError(value: unknown, fallback: string): string {
  const val = value as any
  const msg: unknown = val?.message
  if (!msg || typeof msg !== 'string') return fallback
  if (msg.trimStart().startsWith('{')) return fallback
  return msg
}
