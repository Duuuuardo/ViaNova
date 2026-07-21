import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { createHeadConfig } from '../../lib/seo'

export const Route = createFileRoute('/_auth/verify-email')({ head: () => createHeadConfig('Verificar e-mail — Vianova'),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  const { token } = Route.useSearch()
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'ok' | 'ok-redirect' | 'error'>('loading')

  useEffect(() => {
    if (!token) {
      setState('error')
      return
    }

    api.auth['verify-email'].post({ token }).then(async ({ error }) => {
      if (error) {
        setState('error')
        return
      }

      // Checa se já tem sessão ativa — se sim, manda direto pro app.
      const { data } = await api.auth.me.get()
      if (data && 'user' in data) {
        setState('ok-redirect')
        setTimeout(() => router.navigate({ to: '/' }), 1500)
      } else {
        setState('ok')
      }
    })
  }, [token])

  if (state === 'loading') {
    return <p className="text-sm text-ink-500">Confirmando seu email…</p>
  }

  if (state === 'error') {
    return (
      <>
        <h1 className="font-display text-2xl font-bold text-ink-900 mb-1">Link inválido</h1>
        <p className="text-sm text-ink-500 mb-6">
          Este link de confirmação expirou ou já foi usado. Entre com sua conta para pedir um novo.
        </p>
        <Link to="/login" search={{ redirect_uri: undefined }} className="text-sm text-via-600 hover:text-via-700 font-medium">
          Ir para o login
        </Link>
      </>
    )
  }

  if (state === 'ok-redirect') {
    return (
      <>
        <h1 className="font-display text-2xl font-bold text-ink-900 mb-1">Email confirmado</h1>
        <p className="text-sm text-ink-500">Redirecionando para sua conta…</p>
      </>
    )
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold text-ink-900 mb-1">Email confirmado</h1>
      <p className="text-sm text-ink-500 mb-6">Sua conta está pronta. Agora é só entrar.</p>
      <Link to="/login" search={{ redirect_uri: undefined }} className="text-sm text-via-600 hover:text-via-700 font-medium">
        Ir para o login
      </Link>
    </>
  )
}
