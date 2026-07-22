/**
 * Validação client-side dos forms.
 * As regras de senha espelham a policy do servidor (apps/api/src/lib/password-policy.ts)
 * — mudou lá, muda aqui.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateEmail(email: string): string | null {
  const value = email.trim()
  if (!value) return 'Informe seu email.'
  if (value.length > 254 || !EMAIL_RE.test(value)) return 'Informe um email válido.'
  return null
}

export function validateName(name: string): string | null {
  const value = name.trim()
  if (!value) return 'Informe seu nome.'
  if (value.length < 2) return 'O nome deve ter pelo menos 2 caracteres.'
  if (value.length > 200) return 'O nome deve ter no máximo 200 caracteres.'
  return null
}

// Senhas frequentes em vazamentos que passariam nas regras de tamanho.
const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '12341234',
  '11111111',
  'password',
  'password1',
  'senha1234',
  'senha123',
  'qwerty123',
  'abc12345',
  'a1b2c3d4',
  'brasil123',
])

export type PasswordChecks = {
  minLength: boolean
  cases: boolean
  number: boolean
  symbol: boolean
}

export type PasswordStrength = {
  /** 0–4: 0–1 fraca, 2 média, 3 boa, 4 forte */
  score: 0 | 1 | 2 | 3 | 4
  label: 'Fraca' | 'Média' | 'Boa' | 'Forte'
  checks: PasswordChecks
}

export function passwordStrength(password: string): PasswordStrength {
  const checks: PasswordChecks = {
    minLength: password.length >= 8,
    cases: /[a-z]/.test(password) && /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^a-zA-Z0-9]/.test(password),
  }

  let score = Object.values(checks).filter(Boolean).length
  // Senha comum ou curta nunca passa de "fraca", por mais variada que seja.
  if (!checks.minLength || COMMON_PASSWORDS.has(password.toLowerCase())) {
    score = Math.min(score, 1)
  }

  const labels = ['Fraca', 'Fraca', 'Média', 'Boa', 'Forte'] as const
  return { score: score as PasswordStrength['score'], label: labels[score], checks }
}

/** Policy mínima para aceitar uma senha nova (registro, redefinição, troca). */
export function validateNewPassword(password: string): string | null {
  if (!password) return 'Crie uma senha.'
  if (password.length < 8) return 'A senha deve ter no mínimo 8 caracteres.'
  if (password.length > 128) return 'A senha deve ter no máximo 128 caracteres.'
  if (!/[a-zA-Z]/.test(password)) return 'A senha deve conter pelo menos uma letra.'
  if (!/[0-9]/.test(password)) return 'A senha deve conter pelo menos um número.'
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'Essa senha é muito comum. Escolha outra.'
  
  const strength = passwordStrength(password)
  if (strength.score < 3) return 'Sua senha é muito fraca. Adicione letras maiúsculas/minúsculas ou símbolos.'
  
  return null
}

export function validateTotpCode(code: string): string | null {
  const value = code.trim()
  if (!value) return 'Informe o código.'
  if (!/^[0-9]{6}$/.test(value)) return 'O código deve ter 6 dígitos.'
  return null
}
