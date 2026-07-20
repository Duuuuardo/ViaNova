/**
 * Helpers para segredos obrigatórios.
 *
 * Regra: nenhum fallback hardcoded. Segredos usados em rotas internas devem
 * ser declarados via getRequiredSecret() no carregamento do módulo; assim, se
 * estiverem ausentes, a aplicação falha fatalmente no bootstrap.
 */

const requiredSecrets = new Set<string>()

export function getRequiredSecret(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required secret: ${name}`)
  }
  if (value.length < 16) {
    throw new Error(`Secret ${name} is too short (min 16 characters)`)
  }
  requiredSecrets.add(name)
  return value
}

export function getOptionalSecret(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value : undefined
}

/**
 * Comparação constant-time de segredos.
 * Retorna false imediatamente se o valor fornecido for vazio.
 */
export function verifySecret(provided: string | undefined | null, expected: string): boolean {
  if (!provided) return false
  const providedBuf = Buffer.from(provided)
  const expectedBuf = Buffer.from(expected)
  if (providedBuf.length !== expectedBuf.length) return false
  return (crypto as unknown as { timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean }).timingSafeEqual(
    providedBuf,
    expectedBuf,
  )
}

/**
 * Re-valida todos os segredos obrigatórios no bootstrap.
 * Útil para garantir falha rápida mesmo que algum módulo não tenha sido
 * importado ainda no startup.
 */
export function checkRequiredSecretsOnBootstrap(): void {
  for (const name of requiredSecrets) {
    getRequiredSecret(name)
  }
}
