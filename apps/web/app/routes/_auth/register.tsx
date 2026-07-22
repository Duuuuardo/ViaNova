import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../../lib/api'
import { parseApiError } from '../../lib/api-error'
import { getSession } from '../../lib/auth'
import { safeOidcRedirect } from '../../lib/redirect'
import { Button, ErrorNote } from '../../components/ui'
import { createHeadConfig } from '../../lib/seo'

export const Route = createFileRoute('/_auth/register')({
  head: () => createHeadConfig('Criar conta — Vianova'),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect_uri: typeof search.redirect_uri === 'string' ? search.redirect_uri : undefined,
  }),
  // Já logado não deve ver o cadastro. Completa o OIDC se houver, senão vai pra conta.
  beforeLoad: async ({ search }) => {
    const user = await getSession()
    if (!user) return
    const oidcRedirect = safeOidcRedirect(search.redirect_uri)
    throw redirect(oidcRedirect ? { href: oidcRedirect } : { to: '/' })
  },
  component: RegisterPage,
})

function RegisterPage() {
  const router = useRouter()
  const { redirect_uri } = Route.useSearch()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agreed) {
      setError('Aceite os termos para continuar.')
      return
    }
    setError(null)
    setLoading(true)

    try {
      const { error: apiError } = await api.auth.register.post({ name, email, password })

      if (apiError) {
        setError(parseApiError(apiError.value, 'Não foi possível criar a conta. Tente novamente.'))
        return
      }

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
      <div className="mb-6">
        <h1 className="font-display text-[1.6rem] font-bold tracking-tight text-ink-900 leading-tight">
          Criar conta
        </h1>
        <p className="mt-1.5 text-sm text-ink-500">
          Já tem conta?{' '}
          <Link
            to="/login"
            search={{ redirect_uri }}
            className="text-via-600 hover:text-via-700 font-medium transition-colors"
          >
            Entrar
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="name">Nome</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            required
            autoComplete="name"
          />
        </div>

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
          <label htmlFor="password">Senha</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
              minLength={8}
              autoComplete="new-password"
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
          <p className="mt-1 text-xs text-ink-500">No mínimo 8 caracteres.</p>
        </div>

        {/* Terms */}
        <label className="flex items-start gap-2.5 cursor-pointer select-none mb-0 font-normal text-ink-500">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 shrink-0 size-4 rounded border-line-strong accent-via-600 cursor-pointer"
          />
          <span className="text-sm leading-relaxed">
            Concordo com os{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-via-600 hover:text-via-700 font-medium underline-offset-2 hover:underline transition-colors">
              Termos de Uso
            </a>{' '}
            e a{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-via-600 hover:text-via-700 font-medium underline-offset-2 hover:underline transition-colors">
              Política de Privacidade
            </a>.
          </span>
        </label>

        {error && <ErrorNote>{error}</ErrorNote>}

        <Button type="submit" className="w-full h-11 text-[15px] gap-2" loading={loading}>
          Criar conta
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
