import { createFileRoute, useRouter, getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
import QRCode from 'react-qr-code'
import { api } from '../../lib/api'
import { Button, Card, ErrorNote, Field } from '../../components/ui'

export const Route = createFileRoute('/_app/security')({
  component: SecurityPage,
})

const appRoute = getRouteApi('/_app')

function SecurityPage() {
  const { user } = appRoute.useRouteContext()

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Segurança</h1>
        <p className="mt-1 text-sm text-ink-500">
          Esta conta abre todos os produtos — proteja-a com verificação em duas etapas.
        </p>
      </div>

      {user.twoFactorEnabled ? <DisableTwoFactor /> : <EnableTwoFactor />}
    </div>
  )
}

function EnableTwoFactor() {
  const router = useRouter()
  const [setup, setSetup] = useState<{ uri: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function startSetup() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: apiError } = await api.auth['2fa'].setup.post()
      if (apiError || !data || typeof data.uri !== 'string' || typeof data.secret !== 'string') {
        setError('Não foi possível iniciar o setup. Tente novamente.')
        return
      }
      setSetup({ uri: data.uri, secret: data.secret })
    } finally {
      setLoading(false)
    }
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data, error: apiError } = await api.auth['2fa'].enable.post({ code })
      if (apiError || !data?.backupCodes) {
        setError('Código inválido. Confira o app autenticador e tente de novo.')
        return
      }
      setBackupCodes(data.backupCodes)
    } finally {
      setLoading(false)
    }
  }

  if (backupCodes) {
    return (
      <Card className="p-6 space-y-4">
        <h2 className="font-display text-lg font-bold">Guarde seus códigos de backup</h2>
        <p className="text-sm text-ink-500">
          Cada código funciona uma única vez, caso você perca o acesso ao app autenticador.
          Eles não serão mostrados de novo.
        </p>
        <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-paper rounded-ctrl p-4">
          {backupCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <Button onClick={() => router.invalidate()}>Concluir</Button>
      </Card>
    )
  }

  if (setup) {
    return (
      <Card className="p-6 space-y-4">
        <h2 className="font-display text-lg font-bold">Escaneie o código</h2>
        <p className="text-sm text-ink-500">
          Abra seu app autenticador (Google Authenticator, 1Password…) e escaneie o QR code.
        </p>
        <div className="bg-white p-4 rounded-ctrl border border-line w-fit">
          <QRCode value={setup.uri} size={168} />
        </div>
        <p className="text-xs text-ink-500">
          Ou digite a chave manualmente:{' '}
          <code className="font-mono bg-paper px-1.5 py-0.5 rounded">{setup.secret}</code>
        </p>
        <form onSubmit={confirmCode} className="space-y-4">
          <Field label="Código de 6 dígitos" htmlFor="code">
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              required
              className="font-mono tracking-[0.3em] max-w-40"
              autoComplete="one-time-code"
            />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" loading={loading}>
            Ativar verificação
          </Button>
        </form>
      </Card>
    )
  }

  return (
    <Card className="p-6 flex items-center justify-between gap-4">
      <div>
        <h2 className="font-display text-lg font-bold">Verificação em duas etapas</h2>
        <p className="mt-1 text-sm text-ink-500">
          Além da senha, um código do seu app autenticador ao entrar.
        </p>
        {error && (
          <div className="mt-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </div>
      <Button onClick={startSetup} loading={loading}>
        Ativar
      </Button>
    </Card>
  )
}

function DisableTwoFactor() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error: apiError } = await api.auth['2fa'].disable.post({ code })
      if (apiError) {
        setError('Código inválido.')
        return
      }
      router.invalidate()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-lg font-bold">Verificação em duas etapas</h2>
        <span className="text-xs font-medium text-ok-600 bg-ok-600/10 px-2 py-0.5 rounded-full">
          Ativa
        </span>
      </div>
      <p className="text-sm text-ink-500">
        Para desativar, confirme com um código do app autenticador ou um código de backup.
      </p>
      <form onSubmit={handleDisable} className="flex items-end gap-3">
        <Field label="Código" htmlFor="disable-code">
          <input
            id="disable-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
            required
            className="font-mono tracking-[0.3em] max-w-40"
          />
        </Field>
        <Button type="submit" variant="danger" loading={loading}>
          Desativar
        </Button>
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
    </Card>
  )
}
