import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../../lib/api'
import { parseApiError } from '../../lib/api-error'
import { validateNewPassword } from '../../lib/validation'
import { Button, ErrorNote, Field } from '../../components/ui'
import { PasswordInput, PasswordStrengthMeter } from '../../components/password'
import { createHeadConfig } from '../../lib/seo'

export const Route = createFileRoute('/_auth/reset-password')({ head: () => createHeadConfig('Redefinir senha — Vianova'),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: ResetPasswordPage,
})

type FieldErrors = { password?: string; confirm?: string }

function ResetPasswordPage() {
  const router = useRouter()
  const { token } = Route.useSearch()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError('Link inválido. Peça um novo link de redefinição.')
      return
    }

    const errors: FieldErrors = {
      password: validateNewPassword(password) ?? undefined,
      confirm: password === confirm ? undefined : 'A confirmação não coincide com a nova senha.',
    }
    setFieldErrors(errors)
    if (errors.password || errors.confirm) return

    setLoading(true)
    try {
      const { error: apiError } = await api.auth['reset-password'].post({ token, password })
      if (apiError) {
        setError(parseApiError(apiError.value, 'Link inválido ou expirado.'))
        return
      }
      router.navigate({ to: '/login', search: { redirect_uri: undefined } })
    } catch {
      setError('Não foi possível redefinir a senha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold text-ink-900 mb-1">Nova senha</h1>
      <p className="text-sm text-ink-500 mb-6">
        Crie uma nova senha para sua conta. Você será desconectado de todos os produtos.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Nova senha" htmlFor="password" error={fieldErrors.password}>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setFieldErrors((f) => ({ ...f, password: undefined }))
            }}
            onBlur={() => setFieldErrors((f) => ({ ...f, password: validateNewPassword(password) ?? undefined }))}
            placeholder="Mínimo 8 caracteres, com letras e números"
            required
            autoComplete="new-password"
            invalid={!!fieldErrors.password}
          />
          <PasswordStrengthMeter password={password} />
        </Field>

        <Field label="Confirmar nova senha" htmlFor="confirm" error={fieldErrors.confirm}>
          <PasswordInput
            id="confirm"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value)
              setFieldErrors((f) => ({ ...f, confirm: undefined }))
            }}
            onBlur={() => setFieldErrors((f) => ({ ...f, confirm: password === confirm ? undefined : 'A confirmação não coincide com a nova senha.' }))}
            placeholder="Repita a nova senha"
            required
            autoComplete="new-password"
            invalid={!!fieldErrors.confirm}
          />
        </Field>

        {error && <ErrorNote>{error}</ErrorNote>}

        <Button type="submit" className="w-full" loading={loading}>
          Salvar nova senha
        </Button>
      </form>

      <p className="text-center text-sm text-ink-500 mt-6">
        <Link to="/login" search={{ redirect_uri: undefined }} className="text-via-600 hover:text-via-700 font-medium">
          Voltar para o login
        </Link>
      </p>
    </>
  )
}
