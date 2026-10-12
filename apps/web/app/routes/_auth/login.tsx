import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { parseApiError } from '../../lib/api-error'
import { getSession } from '../../lib/auth'
import { validateEmail } from '../../lib/validation'
import { safeOidcRedirect, productSlugFromRedirect } from '../../lib/redirect'
import { Button, ErrorNote, Field } from '../../components/ui'
import { PasswordInput } from '../../components/password'
import { RouteLine } from '../../components/brand'
import { createHeadConfig } from '../../lib/seo'

export const Route = createFileRoute('/_auth/login')({
  head: () => createHeadConfig('Entrar — Vianova'),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect_uri: typeof search.redirect_uri === 'string' ? search.redirect_uri : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const user = await getSession()
    if (!user) return
    const oidcRedirect = safeOidcRedirect(search.redirect_uri)
    if (oidcRedirect) {
      throw redirect({ href: oidcRedirect })
    }
    throw redirect({ to: '/' })
  },
  component: LoginPage,
})

type FieldErrors = { email?: string; password?: string }

function LoginPage() {
  const router = useRouter()
  const { redirect_uri } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
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

  function validate(): boolean {
    const errors: FieldErrors = {
      email: validateEmail(email) ?? undefined,
      password: password ? undefined : 'Informe sua senha.',
    }
    setFieldErrors(errors)
    return !errors.email && !errors.password
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!validate()) return
    setLoading(true)

    try {
      const { data, error: apiError } = await api.auth.login.post({ email: email.trim(), password })

      if (apiError) {
        setError(parseApiError(apiError.value, 'Não foi possível entrar. Tente novamente.'))
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
        <Field label="Email" htmlFor="email" error={fieldErrors.email}>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }))
            }}
            onBlur={() => setFieldErrors((f) => ({ ...f, email: validateEmail(email) ?? undefined }))}
            placeholder="voce@empresa.com"
            required
            autoComplete="email"
            aria-invalid={fieldErrors.email ? true : undefined}
          />
        </Field>

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
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }))
            }}
            onBlur={() => setFieldErrors((f) => ({ ...f, password: password ? undefined : 'Informe sua senha.' }))}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            invalid={!!fieldErrors.password}
          />
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-danger-600" role="alert">
              {fieldErrors.password}
            </p>
          )}
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
