export function requireEnv(name: string): string {
  const value =
    typeof window !== 'undefined' ? import.meta.env?.[name] : process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`[vianova/web] ${name} is required`)
  }
  return value
}
