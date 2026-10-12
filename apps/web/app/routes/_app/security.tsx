import { createFileRoute, useRouter, getRouteApi } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import QRCode from 'react-qr-code'
import { AlertCircle, Check, ChevronLeft, ChevronRight, KeyRound, Laptop, LogOut, ShieldAlert, ShieldCheck, Smartphone, X } from 'lucide-react'
import { api } from '../../lib/api'
import { parseApiError } from '../../lib/api-error'
import { validateNewPassword, validateTotpCode } from '../../lib/validation'
import { Button, Card, ErrorNote, Field } from '../../components/ui'
import { PasswordInput, PasswordStrengthMeter } from '../../components/password'
import { createHeadConfig } from '../../lib/seo'

export const Route = createFileRoute('/_app/security')({ head: () => createHeadConfig('Segurança — Vianova'),
  component: SecurityPage,
})

const appRoute = getRouteApi('/_app')

type SessionItem = {
  id: string
  ip: string | null
  userAgent: string | null
  createdAt: string | Date
  expiresAt: string | Date
  isCurrent: boolean
}

function SecurityPage() {
  const { user } = appRoute.useRouteContext()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'password' | '2fa' | 'sessions' | 'danger'>('password')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  const [canceling, setCanceling] = useState(false)
  async function handleCancelDeletion() {
    setCanceling(true)
    try {
      await api.auth['cancel-delete-account'].post()
      router.invalidate()
    } finally {
      setCanceling(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-8 pb-16">
      {}
      <div className="pb-6 border-b border-line">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">Segurança da Conta</h1>
        <p className="mt-1 text-sm text-ink-500 max-w-xl">
          Gerencie sua senha, dispositivos ativos, verificação em duas etapas e opções de carência e encerramento da sua conta.
        </p>
      </div>

      {}
      {user.scheduledForDeletionAt && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">
                Sua conta está em período de carência e agendada para exclusão definitiva.
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Data programada: {new Date(user.scheduledForDeletionAt).toLocaleDateString('pt-BR')} às {new Date(user.scheduledForDeletionAt).toLocaleTimeString('pt-BR')}.
                Durante os 15 dias de carência, você pode reativar sua conta e cancelar a exclusão com um clique.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancelDeletion}
            loading={canceling}
            className="shrink-0 font-bold border-amber-400 text-amber-900 hover:bg-amber-100"
          >
            Cancelar exclusão (Reativar conta)
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-line overflow-x-auto pb-px scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('password')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'password'
              ? 'border-via-600 text-via-600 bg-via-500/5'
              : 'border-transparent text-ink-500 hover:text-ink-900 hover:bg-surface/60'
          }`}
        >
          <KeyRound size={16} className={activeTab === 'password' ? 'text-via-600' : 'text-ink-400'} />
          Alterar Senha
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('2fa')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === '2fa'
              ? 'border-via-600 text-via-600 bg-via-500/5'
              : 'border-transparent text-ink-500 hover:text-ink-900 hover:bg-surface/60'
          }`}
        >
          <ShieldCheck size={16} className={activeTab === '2fa' ? 'text-via-600' : 'text-ink-400'} />
          Verificação em Duas Etapas (2FA)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'sessions'
              ? 'border-via-600 text-via-600 bg-via-500/5'
              : 'border-transparent text-ink-500 hover:text-ink-900 hover:bg-surface/60'
          }`}
        >
          <Laptop size={16} className={activeTab === 'sessions' ? 'text-via-600' : 'text-ink-400'} />
          Sessões e Dispositivos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('danger')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'danger'
              ? 'border-red-600 text-red-600 bg-red-500/5'
              : 'border-transparent text-ink-500 hover:text-ink-900 hover:bg-surface/60'
          }`}
        >
          <ShieldAlert size={16} className={activeTab === 'danger' ? 'text-red-600' : 'text-ink-400'} />
          Encerramento de Conta
        </button>
      </div>

      {}
      {activeTab === 'password' && <ChangePasswordSection />}

      {}
      {activeTab === '2fa' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {user.twoFactorEnabled ? <DisableTwoFactor /> : <EnableTwoFactor />}
        </div>
      )}

      {}
      {activeTab === 'sessions' && <SessionsSection />}

      {}
      {activeTab === 'danger' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <Card className="p-6 space-y-4 border-red-200 bg-red-50/20">
            <div className="flex items-center gap-2 text-red-800 font-display font-bold text-lg">
              <ShieldAlert size={20} className="text-red-600" />
              <span>Agendar Exclusão Definitiva (Período de Carência)</span>
            </div>
            <p className="text-sm text-ink-600 leading-relaxed max-w-2xl">
              Ao solicitar a exclusão, sua conta não é removida instantaneamente. Ela é marcada com uma <strong>carência de 15 dias</strong> para segurança e prevenção contra exclusões acidentais.
              Durante esse período, sua conta permanece inativa, e você pode cancelar o agendamento a qualquer momento logando na plataforma.
            </p>

            <div className="pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteModalOpen(true)}
                className="text-red-600 border-red-300 hover:bg-red-50 font-bold"
              >
                Solicitar exclusão da conta (15 dias de carência)
              </Button>
            </div>
          </Card>
        </div>
      )}

      {}
      {deleteModalOpen && (
        <DeleteAccountModal
          onClose={() => setDeleteModalOpen(false)}
          onSuccess={() => {
            setDeleteModalOpen(false)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ current?: string; new?: string; confirm?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const errors = {
      current: currentPassword ? undefined : 'Informe sua senha atual.',
      new:
        validateNewPassword(newPassword) ??
        (newPassword === currentPassword && currentPassword
          ? 'A nova senha deve ser diferente da atual.'
          : undefined),
      confirm:
        newPassword === confirmPassword ? undefined : 'A nova senha e a confirmação não coincidem.',
    }
    setFieldErrors(errors)
    if (errors.current || errors.new || errors.confirm) return

    setLoading(true)
    try {
      const { data, error: apiError } = await api.auth['change-password'].post({
        currentPassword,
        newPassword,
      })

      if (apiError || !data) {
        setError(parseApiError(apiError?.value, 'Não foi possível alterar a senha. Verifique sua senha atual.'))
        return
      }

      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSuccess(false), 4000)
    } catch {
      setError('Não foi possível alterar a senha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6 space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="font-display text-lg font-bold text-ink-900">Alterar Senha de Acesso</h2>
        <p className="text-sm text-ink-500 mt-1">
          Recomendamos escolher uma senha forte e exclusiva, contendo letras, números e caracteres especiais.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md" noValidate>
        <Field label="Senha atual" htmlFor="current-password" error={fieldErrors.current}>
          <PasswordInput
            id="current-password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value)
              setFieldErrors((f) => ({ ...f, current: undefined }))
            }}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            invalid={!!fieldErrors.current}
          />
        </Field>

        <Field label="Nova senha" htmlFor="new-password" error={fieldErrors.new}>
          <PasswordInput
            id="new-password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value)
              setFieldErrors((f) => ({ ...f, new: undefined }))
            }}
            onBlur={() => setFieldErrors((f) => ({ ...f, new: validateNewPassword(newPassword) ?? undefined }))}
            required
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres, com letras e números"
            invalid={!!fieldErrors.new}
          />
          <PasswordStrengthMeter password={newPassword} />
        </Field>

        <Field label="Confirmar nova senha" htmlFor="confirm-password" error={fieldErrors.confirm}>
          <PasswordInput
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              setFieldErrors((f) => ({ ...f, confirm: undefined }))
            }}
            onBlur={() => setFieldErrors((f) => ({ ...f, confirm: newPassword === confirmPassword ? undefined : 'A nova senha e a confirmação não coincidem.' }))}
            required
            autoComplete="new-password"
            placeholder="Repita a nova senha"
            invalid={!!fieldErrors.confirm}
          />
        </Field>

        {error && <ErrorNote>{error}</ErrorNote>}
        {success && (
          <div className="p-3 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
            <Check size={16} className="text-emerald-700" /> Senha alterada com sucesso!
          </div>
        )}

        <div className="pt-2">
          <Button type="submit" loading={loading} className="font-bold">
            Atualizar senha
          </Button>
        </div>
      </form>
    </Card>
  )
}

function SessionsSection() {
  const pageSize = 5
  const [sessions, setSessions] = useState<SessionItem[] | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadSessions() {
    setLoading(true)
    try {
      const { data, error: apiError } = await api.auth.sessions.get()
      if (apiError || !data || !('sessions' in data)) {
        setError('Não foi possível carregar as sessões ativas.')
        return
      }
      setSessions(data.sessions as SessionItem[])
      setPage(1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  async function handleRevokeAll() {
    setRevoking(true)
    setError(null)
    try {
      const { error: apiError } = await api.auth.sessions['revoke-all'].post()
      if (apiError) {
        setError('Não foi possível encerrar as outras sessões. Tente novamente.')
        return
      }
      await loadSessions()
    } catch {
      setError('Não foi possível encerrar as outras sessões. Tente novamente.')
    } finally {
      setRevoking(false)
    }
  }

  async function handleRevokeSingle(id: string) {
    setRevokingId(id)
    setError(null)
    try {
      const { error: apiError } = await api.auth.sessions({ id }).delete()
      if (apiError) {
        setError(parseApiError(apiError?.value, 'Não foi possível encerrar esta sessão.'))
        return
      }
      await loadSessions()
    } finally {
      setRevokingId(null)
    }
  }

  const orderedSessions = sessions
    ? [...sessions].sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    : []
  const pageCount = Math.max(1, Math.ceil(orderedSessions.length / pageSize))
  const visibleSessions = orderedSessions.slice((page - 1) * pageSize, page * pageSize)
  const rangeStart = orderedSessions.length === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, orderedSessions.length)

  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-900">Sessões e Dispositivos Ativos</h2>
          <p className="text-sm text-ink-500 mt-1">
            Mantenha controle total dos dispositivos conectados para proteger suas campanhas e dados de receita.
          </p>
        </div>
        {sessions && sessions.length > 1 && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleRevokeAll}
            loading={revoking}
            className="w-full shrink-0 text-xs font-bold text-red-600 border-red-200 transition-[background-color,color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-red-50 active:scale-[0.97] sm:w-auto"
          >
            <LogOut size={14} className="mr-1.5 inline" /> Encerrar todas as outras sessões
          </Button>
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !sessions && <p className="text-sm text-ink-500">Carregando sessões ativas...</p>}

      {sessions && (
        <div className="space-y-3">
          {visibleSessions.map((s) => {
            const isMobile = s.userAgent?.toLowerCase().includes('mobile') || s.userAgent?.toLowerCase().includes('iphone') || s.userAgent?.toLowerCase().includes('android')
            const browserName = s.userAgent?.includes('Chrome') ? 'Google Chrome' : s.userAgent?.includes('Firefox') ? 'Mozilla Firefox' : s.userAgent?.includes('Safari') && !s.userAgent?.includes('Chrome') ? 'Safari' : 'Navegador Web'
            const osName = s.userAgent?.includes('Linux') ? 'Linux' : s.userAgent?.includes('Mac OS') ? 'macOS' : s.userAgent?.includes('Windows') ? 'Windows' : 'Dispositivo'

            return (
              <div
                key={s.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-[background-color,border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                  s.isCurrent ? 'border-via-600 bg-via-50/60 ring-1 ring-via-600 shadow-2xs' : 'border-line hover:border-line-strong bg-paper'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="size-10 rounded-lg bg-surface border border-line grid place-items-center text-ink-700 shrink-0">
                    {isMobile ? <Smartphone size={20} /> : <Laptop size={20} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-ink-900 truncate">{browserName} · {osName}</p>
                      {s.isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase tracking-wider shrink-0">
                          Sessão Atual
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-500 truncate mt-0.5">
                      IP: <code className="font-mono">{s.ip || 'Não disponível'}</code> · Conectado em {new Date(s.createdAt).toLocaleDateString('pt-BR')} às {new Date(s.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {!s.isCurrent && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleRevokeSingle(s.id)}
                    loading={revokingId === s.id}
                    className="w-full shrink-0 px-3 py-1.5 text-xs font-semibold text-red-600 border-red-200 transition-[background-color,color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-red-50 active:scale-[0.97] sm:w-auto"
                  >
                    Encerrar
                  </Button>
                )}
              </div>
            )
          })}

          {orderedSessions.length > 0 && (
            <nav
              aria-label="Paginação das sessões"
              className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-xs text-ink-500">
                Mostrando {rangeStart}–{rangeEnd} de {orderedSessions.length} sessões
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  aria-label="Página anterior"
                  className="grid size-9 place-items-center rounded-ctrl border border-line-strong bg-surface text-ink-700 transition-[background-color,color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-paper active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <span className="min-w-20 text-center text-xs font-semibold text-ink-700" aria-live="polite">
                  Página {page} de {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={page === pageCount}
                  aria-label="Próxima página"
                  className="grid size-9 place-items-center rounded-ctrl border border-line-strong bg-surface text-ink-700 transition-[background-color,color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-paper active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            </nav>
          )}
        </div>
      )}
    </Card>
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
        setError('Não foi possível iniciar a configuração. Tente novamente.')
        return
      }
      setSetup({ uri: data.uri, secret: data.secret })
    } finally {
      setLoading(false)
    }
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const codeError = validateTotpCode(code)
    if (codeError) {
      setError(codeError)
      return
    }
    setLoading(true)
    try {
      const { data, error: apiError } = await api.auth['2fa'].enable.post({ code: code.trim() })
      if (apiError || !data?.backupCodes) {
        setError('Código inválido. Verifique seu aplicativo autenticador e tente novamente.')
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
        <h2 className="font-display text-lg font-bold">Guarde seus códigos de recuperação</h2>
        <p className="text-sm text-ink-500">
          Cada código funciona uma única vez, caso você perca o acesso ao aplicativo autenticador.
          Eles não serão exibidos novamente.
        </p>
        <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-paper rounded-ctrl p-4 border border-line">
          {backupCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <Button onClick={() => router.invalidate()}>Concluir configuração</Button>
      </Card>
    )
  }

  if (setup) {
    return (
      <Card className="p-6 space-y-5">
        <h2 className="font-display text-lg font-bold">Escaneie o código QR</h2>
        <p className="text-sm text-ink-500">
          Abra seu aplicativo autenticador (Google Authenticator, 1Password, Authy) e escaneie a imagem abaixo.
        </p>
        <div className="bg-white p-4 rounded-ctrl border border-line w-fit shadow-xs">
          <QRCode value={setup.uri} size={168} />
        </div>
        <p className="text-xs text-ink-500">
          Ou digite a chave de segurança manualmente:{' '}
          <code className="font-mono bg-paper px-2 py-1 rounded border border-line font-bold">{setup.secret}</code>
        </p>
        <form onSubmit={confirmCode} className="space-y-4 max-w-sm pt-2">
          <Field label="Código de 6 dígitos gerado pelo app" htmlFor="code">
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              required
              inputMode="numeric"
              maxLength={6}
              className="font-mono tracking-[0.3em] max-w-44 text-center text-lg h-11"
              autoComplete="one-time-code"
            />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" loading={loading} className="font-bold">
            Ativar verificação
          </Button>
        </form>
      </Card>
    )
  }

  return (
    <Card className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
      <div className="space-y-1">
        <h2 className="font-display text-lg font-bold">Verificação em Duas Etapas (2FA)</h2>
        <p className="text-sm text-ink-500 max-w-xl">
          Adiciona uma camada extra de proteção à sua conta. Além da senha, será solicitado um código temporário de 6 dígitos ao fazer login.
        </p>
        {error && (
          <div className="pt-2">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </div>
      <Button onClick={startSetup} loading={loading} className="shrink-0 font-bold">
        Configurar 2FA
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
    setError(null)
    const trimmedCode = code.trim().replace(/\s+/g, '')
    if (!trimmedCode) {
      setError('Informe o código do app autenticador ou um código de backup.')
      return
    }
    setLoading(true)
    try {
      const { error: apiError } = await api.auth['2fa'].disable.post({ code: trimmedCode })
      if (apiError) {
        setError('Código inválido. Verifique o aplicativo autenticador.')
        return
      }
      router.invalidate()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-bold">Verificação em Duas Etapas</h2>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Ativa
          </span>
        </div>
      </div>
      <p className="text-sm text-ink-500">
        Para desativar a proteção em duas etapas, confirme abaixo com um código do aplicativo autenticador ou um código de recuperação de backup.
      </p>
      <form onSubmit={handleDisable} className="flex flex-col sm:flex-row items-start sm:items-end gap-3 max-w-md">
        <Field label="Código de confirmação" htmlFor="disable-code">
          <input
            id="disable-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
            required
            className="font-mono tracking-[0.3em] max-w-44 text-center"
          />
        </Field>
        <Button type="submit" variant="danger" loading={loading} className="font-bold">
          Desativar 2FA
        </Button>
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
    </Card>
  )
}

function DeleteAccountModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data, error: apiError } = await api.auth['delete-account'].post({ password: password || undefined })
      if (apiError || !data) {
        setError(parseApiError(apiError?.value, 'A senha informada está incorreta.'))
        return
      }
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <Card className="w-full max-w-md p-6 space-y-5 bg-white shadow-xl border border-line animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2 text-red-600 font-display font-bold text-lg">
            <ShieldAlert size={22} />
            <span>Confirmar Encerramento de Conta</span>
          </div>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700 p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-sm text-ink-600 leading-relaxed">
          <p>
            Sua conta entrará em <strong>período de carência de 15 dias</strong> e ficará indisponível para novos acessos.
          </p>
          <p>
            Se você mudar de ideia durante esses 15 dias, basta fazer login na plataforma e clicar em <strong>"Cancelar exclusão"</strong> para reativar todos os seus dados e configurações imediatamente.
          </p>
        </div>

        <form onSubmit={handleConfirm} className="space-y-4 pt-2 border-t border-line">
          <Field label="Digite sua senha atual para confirmar" htmlFor="confirm-delete-password">
            <input
              id="confirm-delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full"
              placeholder="Sua senha de acesso"
            />
          </Field>

          {error && <ErrorNote>{error}</ErrorNote>}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="w-full sm:w-auto">
              Voltar
            </Button>
            <Button type="submit" variant="danger" loading={loading} className="font-bold w-full sm:w-auto">
              Agendar exclusão (15 dias)
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
