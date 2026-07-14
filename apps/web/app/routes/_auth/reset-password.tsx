import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../../lib/api'
import { Button, ErrorNote, Field } from '../../components/ui'

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const router = useRouter()
  const { token } = Route.useSearch()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      setError('Link inválido. Peça um novo link de redefinição.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { error: apiError } = await api.auth['reset-password'].post({ token, password })
      if (apiError) {
        setError(
          (apiError.value as { message?: string })?.message ?? 'Link inválido ou expirado.',
        )
        return
      }
      router.navigate({ to: '/login', search: { redirect_uri: undefined } })
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nova senha" htmlFor="password" hint="No mínimo 8 caracteres.">
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
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
