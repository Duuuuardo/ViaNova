
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

export function checkPasswordPolicy(password: string): string | null {
  if (password.length < 8) return 'A senha deve ter no mínimo 8 caracteres.'
  if (password.length > 128) return 'A senha deve ter no máximo 128 caracteres.'
  if (!/[a-zA-Z]/.test(password)) return 'A senha deve conter pelo menos uma letra.'
  if (!/[0-9]/.test(password)) return 'A senha deve conter pelo menos um número.'
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'Essa senha é muito comum. Escolha outra.'
  
  const hasCases = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  
  if (!hasCases && !hasSymbol) {
    return 'Sua senha é muito fraca. Adicione letras maiúsculas/minúsculas ou símbolos.';
  }

  return null
}
