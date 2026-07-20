import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { safeOidcRedirect, productSlugFromRedirect } from '../../lib/redirect'
import { Button, ErrorNote } from '../../components/ui'
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
  const [showPassword, setShowPassword] = useState(false)
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
        sessionStorage.setItem('2fa_challenge_token', data.challengeToken)
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

      <div className="mb-6">
        <h1 className="font-display text-[1.6rem] font-bold tracking-tight text-ink-900 leading-tight">
          {destination ? `Entrar no ${destination}` : 'Entrar na sua conta'}
        </h1>
        <p className="mt-1.5 text-sm text-ink-500">
          Não tem conta?{' '}
          <Link
            to="/register"
            search={{ redirect_uri }}
            className="text-via-600 hover:text-via-700 font-medium transition-colors"
          >
            Criar conta grátis
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            required
            autoComplete="email"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="mb-0">Senha</label>
            <Link
              to="/forgot-password"
              className="text-xs text-ink-500 hover:text-via-600 transition-colors"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 transition-colors"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <Button type="submit" className="w-full h-11 text-[15px] gap-2" loading={loading}>
          Entrar
          {!loading && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </Button>
      </form>
    </>
  )
}
