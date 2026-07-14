import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

export const Route = createFileRoute('/_auth/verify-email')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  const { token } = Route.useSearch()
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    if (!token) {
      setState('error')
      return
    }
    api.auth['verify-email'].post({ token }).then(({ error }) => {
      setState(error ? 'error' : 'ok')
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

  return (
    <>
      <h1 className="font-display text-2xl font-bold text-ink-900 mb-1">Email confirmado</h1>
      <p className="text-sm text-ink-500 mb-6">Sua conta está ativa. Agora é só entrar.</p>
      <Link to="/login" search={{ redirect_uri: undefined }} className="text-sm text-via-600 hover:text-via-700 font-medium">
        Ir para o login
      </Link>
    </>
  )
}
