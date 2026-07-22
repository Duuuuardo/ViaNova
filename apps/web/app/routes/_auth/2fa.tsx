import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../../lib/api'
import { safeOidcRedirect } from '../../lib/redirect'
import { Button, ErrorNote, Field } from '../../components/ui'
import { createHeadConfig } from '../../lib/seo'

export const Route = createFileRoute('/_auth/2fa')({ head: () => createHeadConfig('Verificação em duas etapas — Vianova'),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect_uri: typeof search.redirect_uri === 'string' ? search.redirect_uri : undefined,
  }),
  component: TwoFactorPage,
})

function TwoFactorPage() {
  const router = useRouter()
  const { redirect_uri } = Route.useSearch()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedCode = code.trim().replace(/\s+/g, '')
    if (!trimmedCode) {
      setError('Informe o código do app autenticador ou um código de backup.')
      return
    }

    const challengeToken = sessionStorage.getItem('2fa_challenge_token')
    if (!challengeToken) {
      router.navigate({ to: '/login', search: { redirect_uri } })
      return
    }

    setLoading(true)
    try {
      const { data, error: apiError } = await api.auth.login.post({
        challengeToken,
        totpCode: trimmedCode,
      })

      if (apiError || !data || !('user' in data)) {
        setError('Código inválido. Tente novamente.')
        return
      }

      sessionStorage.removeItem('2fa_challenge_token')

      const oidcRedirect = safeOidcRedirect(redirect_uri)
      if (oidcRedirect) {
        window.location.href = oidcRedirect
        return
      }

      router.navigate({ to: '/' })
    } catch {
      setError('Código inválido. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold text-ink-900 mb-1">Verificação em duas etapas</h1>
      <p className="text-sm text-ink-500 mb-6">
        Digite o código do seu app autenticador, ou um dos seus códigos de backup.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Código" htmlFor="code">
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setError(null)
            }}
            onBlur={() => {
              if (!code.trim()) setError('Informe o código do app autenticador ou um código de backup.')
            }}
            placeholder="000000"
            required
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={16}
            className="font-mono tracking-[0.3em]"
            autoFocus
          />
        </Field>

        {error && <ErrorNote>{error}</ErrorNote>}

        <Button type="submit" className="w-full" loading={loading}>
          Verificar
        </Button>
      </form>
    </>
  )
}
