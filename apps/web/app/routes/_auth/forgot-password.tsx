import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../../lib/api'
import { Button, Field } from '../../components/ui'

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.auth['forgot-password'].post({ email })
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <>
        <h1 className="font-display text-2xl font-bold text-ink-900 mb-1">Verifique seu email</h1>
        <p className="text-sm text-ink-500 mb-6">
          Se existir uma conta para <strong className="text-ink-700">{email}</strong>, você
          receberá um link para redefinir a senha.
        </p>
        <Link to="/login" search={{ redirect_uri: undefined }} className="text-sm text-via-600 hover:text-via-700 font-medium">
          Voltar para o login
        </Link>
      </>
    )
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold text-ink-900 mb-1">Redefinir senha</h1>
      <p className="text-sm text-ink-500 mb-6">
        Digite seu email e enviaremos um link para criar uma nova senha.
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

        <Button type="submit" className="w-full" loading={loading}>
          Enviar link
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
