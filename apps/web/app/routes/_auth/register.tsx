import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../../lib/api'
import { safeOidcRedirect } from '../../lib/redirect'
import { Button, ErrorNote, Field } from '../../components/ui'

export const Route = createFileRoute('/_auth/register')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect_uri: typeof search.redirect_uri === 'string' ? search.redirect_uri : undefined,
  }),
  component: RegisterPage,
})

function RegisterPage() {
  const router = useRouter()
  const { redirect_uri } = Route.useSearch()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: apiError } = await api.auth.register.post({ name, email, password })

      if (apiError) {
        setError(
          (apiError.value as { message?: string })?.message ??
            'Não foi possível criar a conta. Tente novamente.',
        )
        return
      }

      // A conta já nasce logada — a confirmação de email fica como aviso
      // dentro do app, sem bloquear o primeiro acesso.
      const oidcRedirect = safeOidcRedirect(redirect_uri)
      if (oidcRedirect) {
        window.location.href = oidcRedirect
        return
      }

      router.navigate({ to: '/' })
    } catch {
      setError('Não foi possível criar a conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold text-ink-900 mb-1">Criar conta</h1>
      <p className="text-sm text-ink-500 mb-6">Uma conta Vianova dá acesso a todos os produtos.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome" htmlFor="name">
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            required
            autoComplete="name"
          />
        </Field>

        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            required
            autoComplete="email"
          />
        </Field>

        <Field label="Senha" htmlFor="password" hint="No mínimo 8 caracteres.">
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
          Criar conta
        </Button>
      </form>

      <p className="text-center text-sm text-ink-500 mt-6">
        Já tem conta?{' '}
        <Link
          to="/login"
          search={{ redirect_uri }}
          className="text-via-600 hover:text-via-700 font-medium"
        >
          Entrar
        </Link>
      </p>
    </>
  )
}
