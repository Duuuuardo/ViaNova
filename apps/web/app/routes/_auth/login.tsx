import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { safeOidcRedirect, productSlugFromRedirect } from '../../lib/redirect'
import { Button, ErrorNote, Field } from '../../components/ui'
import { RouteLine } from '../../components/brand'

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect_uri: typeof search.redirect_uri === 'string' ? search.redirect_uri : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const { redirect_uri } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [destination, setDestination] = useState<string | null>(null)

  useEffect(() => {
    const slug = productSlugFromRedirect(redirect_uri)
    if (!slug) return
    api.products.get().then(({ data }) => {
      const product = data?.products?.find((p) => p.slug === slug)
      setDestination(product?.name ?? slug)
    })
  }, [redirect_uri])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: apiError } = await api.auth.login.post({ email, password })

      if (apiError) {
        const value = apiError.value as { message?: string }
        setError(value?.message ?? 'Não foi possível entrar. Tente novamente.')
        return
      }

      if (data && 'requires2FA' in data && data.requires2FA) {
        sessionStorage.setItem('2fa_email', email)
        sessionStorage.setItem('2fa_password', password)
        router.navigate({ to: '/2fa', search: { redirect_uri } })
        return
      }

      const oidcRedirect = safeOidcRedirect(redirect_uri)
      if (oidcRedirect) {
        window.location.href = oidcRedirect
        return
      }

      router.navigate({ to: '/' })
    } catch {
      setError('Não foi possível entrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {destination && (
        <div className="mb-6">
          <RouteLine destination={destination} />
        </div>
      )}

      <h1 className="font-display text-2xl font-bold text-ink-900 mb-1">Entrar</h1>
      <p className="text-sm text-ink-500 mb-6">
        {destination
          ? `Entre com sua conta Vianova para continuar no ${destination}.`
          : 'Entre com sua conta Vianova.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="mb-0">
              Senha
            </label>
            <Link
              to="/forgot-password"
              className="text-xs text-via-600 hover:text-via-700 font-medium"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <Button type="submit" className="w-full" loading={loading}>
          Entrar
        </Button>
      </form>

      <p className="text-center text-sm text-ink-500 mt-6">
        Não tem conta?{' '}
        <Link
          to="/register"
          search={{ redirect_uri }}
          className="text-via-600 hover:text-via-700 font-medium"
        >
          Criar conta
        </Link>
      </p>
    </>
  )
}
