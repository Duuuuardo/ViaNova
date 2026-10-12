import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../../lib/api'
import { parseApiError } from '../../lib/api-error'
import { getSession } from '../../lib/auth'
import { validateEmail, validateName, validateNewPassword } from '../../lib/validation'
import { safeOidcRedirect } from '../../lib/redirect'
import { Button, ErrorNote, Field } from '../../components/ui'
import { PasswordInput, PasswordStrengthMeter } from '../../components/password'
import { createHeadConfig } from '../../lib/seo'

export const Route = createFileRoute('/_auth/register')({
  head: () => createHeadConfig('Criar conta — Vianova'),
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
  component: RegisterPage,
})

type FieldErrors = { name?: string; email?: string; password?: string; terms?: string }

function RegisterPage() {
  const router = useRouter()
  const { redirect_uri } = Route.useSearch()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function validate(): boolean {
    const errors: FieldErrors = {
      name: validateName(name) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validateNewPassword(password) ?? undefined,
      terms: agreed ? undefined : 'Aceite os termos para continuar.',
    }
    setFieldErrors(errors)
    return !errors.name && !errors.email && !errors.password && !errors.terms
  }

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((f) => (f[field] ? { ...f, [field]: undefined } : f))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!validate()) return
    setLoading(true)

    try {
      const { error: apiError } = await api.auth.register.post({
        name: name.trim(),
        email: email.trim(),
        password,
      })

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
        <Field label="Nome" htmlFor="name" error={fieldErrors.name}>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              clearFieldError('name')
            }}
            onBlur={() => setFieldErrors((f) => ({ ...f, name: validateName(name) ?? undefined }))}
            placeholder="Seu nome"
            required
            autoComplete="name"
            maxLength={200}
            aria-invalid={fieldErrors.name ? true : undefined}
          />
        </Field>

        <Field label="Email" htmlFor="email" error={fieldErrors.email}>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              clearFieldError('email')
            }}
            onBlur={() => setFieldErrors((f) => ({ ...f, email: validateEmail(email) ?? undefined }))}
            placeholder="voce@empresa.com"
            required
            autoComplete="email"
            aria-invalid={fieldErrors.email ? true : undefined}
          />
        </Field>

        <div>
          <label htmlFor="password">Senha</label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              clearFieldError('password')
            }}
            onBlur={() => setFieldErrors((f) => ({ ...f, password: validateNewPassword(password) ?? undefined }))}
            placeholder="Mínimo 8 caracteres, com letras e números"
            required
            autoComplete="new-password"
            invalid={!!fieldErrors.password}
          />
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-danger-600" role="alert">
              {fieldErrors.password}
            </p>
          )}
          <PasswordStrengthMeter password={password} />
        </div>

        {}
        <div>
          <label className="flex items-start gap-2.5 cursor-pointer select-none mb-0 font-normal text-ink-500">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked)
                clearFieldError('terms')
              }}
              onBlur={() => setFieldErrors((f) => ({ ...f, terms: agreed ? undefined : 'Aceite os termos para continuar.' }))}
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
          {fieldErrors.terms && (
            <p className="mt-1 text-xs text-danger-600" role="alert">
              {fieldErrors.terms}
            </p>
          )}
        </div>

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
