import { createFileRoute, Link, useRouter, getRouteApi } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  Camera,
  Check,
  Globe,
  Palette,
  ShieldAlert,
  Sparkles,
  UserCheck,
  BellRing,
  Laptop,
  Download,
  ExternalLink,
  Info,
  AlertCircle,
  X,
} from 'lucide-react'
import { api } from '../../lib/api'
import { Button, Card, ErrorNote, Field, SectionTitle, StatusDot, ToggleRow } from '../../components/ui'
import { Avatar, type AvatarFrame } from '../../components/avatar'
import { AvatarCropper } from '../../components/avatar-cropper'
import { createHeadConfig } from '../../lib/seo'
import { validateName } from '../../lib/validation'

export const Route = createFileRoute('/_app/profile')({ head: () => createHeadConfig('Perfil — Vianova'),
  component: ProfilePage,
})

const appRoute = getRouteApi('/_app')

const frameOptions: { value: AvatarFrame; label: string; description: string }[] = [
  { value: 'none', label: 'Sem moldura', description: 'Padrão corporativo minimalista' },
  { value: 'via', label: 'Roxa Vianova', description: 'Destaque visual da marca' },
  { value: 'gradient', label: 'Degradê Premium', description: 'Para fundadores e líderes' },
]

type TabId = 'general' | 'localization' | 'appearance' | 'notifications' | 'apps'

function ProfilePage() {
  const router = useRouter()
  const { user } = appRoute.useRouteContext()
  const [activeTab, setActiveTab] = useState<TabId>('general')
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

  const [name, setName] = useState(user.name)
  const [nameError, setNameError] = useState<string | null>(null)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [jobTitle, setJobTitle] = useState((user as Record<string, any>).jobTitle ?? '')
  const [department, setDepartment] = useState((user as Record<string, any>).department ?? '')
  const [frame, setFrame] = useState<AvatarFrame>((user.avatarFrame as AvatarFrame) ?? 'none')
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? null)

  const [location, setLocation] = useState((user as Record<string, any>).location ?? '')
  const [timezone, setTimezone] = useState((user as Record<string, any>).timezone ?? 'America/Sao_Paulo')
  const [locale, setLocale] = useState((user as Record<string, any>).locale ?? 'pt-BR')

  const initialPrefs = (user as Record<string, any>).preferences ?? {
    theme: 'system',
    reducedMotion: false,
    billingAlerts: true,
    securityAlerts: true,
    marketingEmails: false,
  }
  const [preferences, setPreferences] = useState(initialPrefs)

  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [exported, setExported] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    setError(null)
    setUploading(true)
    try {
      const { data, error: apiError } = await api.account.avatar.post({ file })
      if (apiError) {
        setError(
          typeof apiError.value === 'object' && apiError.value && 'message' in apiError.value
            ? String(apiError.value.message)
            : 'Não foi possível enviar a foto. Tente novamente.',
        )
        return false
      }
      if (data?.user?.avatarUrl) setAvatarUrl(data.user.avatarUrl)
      router.invalidate()
      return true
    } catch {
      setError('Não foi possível enviar a foto. Tente novamente.')
      return false
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validNameError = validateName(name)
    setNameError(validNameError)
    if (validNameError) {
      setActiveTab('general')
      return
    }

    setError(null)
    setSaved(false)
    setLoading(true)
    try {
      const { error: apiError } = await api.auth.profile.patch({
        name,
        phone,
        avatarFrame: frame,
        jobTitle: jobTitle || undefined,
        department: department || undefined,
        location: location || undefined,
        timezone,
        locale,
        preferences,
      })
      if (apiError) {
        setError('Não foi possível salvar as alterações do perfil. Tente novamente.')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
      router.invalidate()
    } finally {
      setLoading(false)
    }
  }

  function handleExportData() {
    const exportData = {
      user: {
        id: user.id,
        name,
        email: user.email,
        phone,
        jobTitle,
        department,
        location,
        timezone,
        locale,
        preferences,
        avatarFrame: frame,
        emailVerifiedAt: user.emailVerifiedAt,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
      },
      exportedAt: new Date().toISOString(),
      compliance: 'Account Data Export',
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vianova-account-export-${user.email.replace(/[@.]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExported(true)
    setTimeout(() => setExported(false), 5000)
  }

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'general', label: 'Dados Pessoais', icon: UserCheck },
    { id: 'localization', label: 'Fuso & Idioma', icon: Globe },
    { id: 'appearance', label: 'Aparência', icon: Palette },
    { id: 'notifications', label: 'Notificações', icon: BellRing },
    { id: 'apps', label: 'Aplicativos & Dados', icon: Laptop },
  ]

  return (
    <div className="max-w-4xl space-y-8 pb-12">
      {}
      {(user as any).scheduledForDeletionAt && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">
                Sua conta está em período de carência e agendada para exclusão definitiva.
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Data programada: {new Date((user as any).scheduledForDeletionAt).toLocaleDateString('pt-BR')} às {new Date((user as any).scheduledForDeletionAt).toLocaleTimeString('pt-BR')}.
                Durante os 15 dias de carência, você pode reativar sua conta e cancelar a exclusão.
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-line">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">Perfil e Preferências</h1>
          <p className="mt-1 text-sm text-ink-500 max-w-xl">
            Defina como você aparece para sua equipe e configure suas preferências de acesso.
          </p>
        </div>

        <div className="bg-paper border border-line rounded-xl p-3.5 shadow-2xs flex items-center gap-3.5 shrink-0 w-full md:w-auto md:max-w-xs">
          <Avatar name={name} avatarUrl={avatarUrl} frame={frame} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-ink-900 truncate">{name || 'Seu Nome'}</p>
              <span className="size-2 rounded-full bg-emerald-500 shrink-0" title="Identidade Ativa" />
            </div>
            <p className="text-xs text-ink-500 truncate">{jobTitle || 'Sem cargo definido'}</p>
            <p className="text-[10px] text-via-600 font-mono mt-0.5 truncate">{user.email}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-b border-line overflow-x-auto pb-px scrollbar-none">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
              activeTab === id
                ? 'border-via-600 text-via-600 bg-via-500/5'
                : 'border-transparent text-ink-500 hover:text-ink-900 hover:bg-surface/60'
            }`}
          >
            <Icon size={16} className={activeTab === id ? 'text-via-600' : 'text-ink-400'} />
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {activeTab === 'general' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <Card className="p-6 space-y-6">
              <SectionTitle>Foto de Perfil & Moldura de Exibição</SectionTitle>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-line/70">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="group relative m-1.5 shrink-0 rounded-full shadow-sm"
                  aria-label="Trocar foto do avatar"
                  disabled={uploading}
                >
                  <Avatar name={name} avatarUrl={avatarUrl} frame={frame} size="lg" />
                  <span className="absolute inset-0 grid place-items-center rounded-full bg-ink-900/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    {uploading ? (
                      <span className="size-5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />
                    ) : (
                      <Camera size={20} aria-hidden="true" />
                    )}
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setAvatarFile(file)
                    e.target.value = ''
                  }}
                />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-ink-900">Foto de Perfil do Ecossistema</p>
                  <p className="text-xs text-ink-500 max-w-md leading-relaxed">
                    Sua foto é atualizada automaticamente em todos os aplicativos conectados à sua conta, como Campanhas e CRM.
                  </p>
                  <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-2 text-xs py-1.5 px-3">
                    {uploading ? 'Enviando foto...' : 'Escolher nova foto'}
                  </Button>
                </div>
              </div>

              <div>
                <span className="block text-sm font-bold text-ink-800 mb-2">Moldura do Cartão (Avatar Frame)</span>
                <div role="radiogroup" aria-label="Moldura do avatar" className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {frameOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={frame === option.value}
                      onClick={() => setFrame(option.value)}
                      className={`flex flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition-all ${
                        frame === option.value
                          ? 'border-via-600 bg-via-50 shadow-2xs ring-1 ring-via-600'
                          : 'border-line hover:border-line-strong bg-paper'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <Avatar name={name} avatarUrl={avatarUrl} frame={option.value} size="md" />
                        {frame === option.value && <Check size={16} className="text-via-600" />}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-ink-900 block">{option.label}</span>
                        <span className="text-xs text-ink-500 leading-tight block mt-0.5">{option.description}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-5">
              <SectionTitle>Identidade & Contato Principal</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nome Completo" htmlFor="name">
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setNameError(null)
                    }}
                    onBlur={() => setNameError(validateName(name))}
                    aria-invalid={nameError ? true : undefined}
                    required
                    className={`w-full ${nameError ? 'border-red-400' : ''}`}
                  />
                  {nameError && (
                    <span className="text-[11px] text-red-500 mt-1 block" role="alert">{nameError}</span>
                  )}
                </Field>

                <Field label="Telefone / WhatsApp" htmlFor="phone">
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+55 11 99999-0000"
                    className="w-full"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Cargo / Função no Ecossistema" htmlFor="jobTitle">
                  <input
                    id="jobTitle"
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Ex.: Head de Growth, Fundador"
                    className="w-full"
                  />
                </Field>

                <Field label="Departamento ou Empresa" htmlFor="department">
                  <input
                    id="department"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Ex.: Operações · Vianova Hub"
                    className="w-full"
                  />
                </Field>
              </div>

              <div className="rounded-xl bg-surface border border-line p-4 space-y-2 mt-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-ink-700 uppercase tracking-wider">E-mail Principal</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <StatusDot tone="ok" /> {user.emailVerifiedAt ? 'E-mail Verificado' : 'Verificado'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-ink-900">{user.email}</span>
                  <span className="text-xs text-ink-400">
                    Membro desde {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '2026'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'localization' && (
          <Card className="p-6 space-y-6 animate-in fade-in duration-200">
            <SectionTitle>Fuso Horário & Localização do Usuário</SectionTitle>
            <p className="text-sm text-ink-500">
              Usado para formatar datas e horários nos produtos conectados à sua conta.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Fuso Horário (Timezone)" htmlFor="timezone">
                <select
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full h-10 px-3 rounded-ctrl border border-line bg-white text-sm font-medium"
                >
                  <option value="America/Sao_Paulo">(GMT-03:00) Horário de Brasília (America/Sao_Paulo)</option>
                  <option value="America/Manaus">(GMT-04:00) Manaus / Amazonas</option>
                  <option value="America/Recife">(GMT-03:00) Recife / Nordeste</option>
                  <option value="America/New_York">(GMT-05:00) Nova York (EST/EDT)</option>
                  <option value="UTC">(UTC+00:00) Tempo Universal Coordenado (UTC)</option>
                  <option value="Europe/Lisbon">(GMT+00:00/01:00) Lisboa / Porto</option>
                </select>
              </Field>

              <Field label="Idioma da Interface (Locale)" htmlFor="locale">
                <select
                  id="locale"
                  value="pt-BR"
                  disabled
                  className="w-full h-10 px-3 rounded-ctrl border border-line bg-paper text-ink-700 text-sm font-semibold cursor-not-allowed"
                >
                  <option value="pt-BR">Português (Brasil)</option>
                </select>
                <span className="text-[11px] text-ink-400 mt-1 block">
                  Outros idiomas em breve.
                </span>
              </Field>
            </div>

            <LocationSelector location={location} onChangeLocation={setLocation} />
          </Card>
        )}

        {activeTab === 'appearance' && (
          <Card className="p-6 space-y-6 animate-in fade-in duration-200">
            <SectionTitle>Aparência</SectionTitle>

            <div className="space-y-4">
              <span className="block text-sm font-bold text-ink-800">Tema da Interface</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {(['system', 'light', 'dark'] as const).map((themeVal) => (
                  <button
                    key={themeVal}
                    type="button"
                    onClick={() => setPreferences({ ...preferences, theme: themeVal })}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      preferences.theme === themeVal
                        ? 'border-via-600 bg-via-50 shadow-2xs font-bold ring-1 ring-via-600'
                        : 'border-line hover:border-line-strong bg-paper'
                    }`}
                  >
                    <span className="text-sm text-ink-900 font-bold">
                      {themeVal === 'system' ? 'Automático (Sistema)' : themeVal === 'light' ? 'Modo Claro' : 'Modo Escuro'}
                    </span>
                    <span className="text-xs text-ink-500 mt-1">
                      {themeVal === 'system' ? 'Acompanha o seu sistema' : themeVal === 'light' ? 'Superfícies claras e limpas' : 'Alto contraste noturno'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-line">
              <ToggleRow
                id="smooth-motion"
                label={
                  <span className="flex items-center gap-2">
                    <Sparkles size={16} className="text-via-600" /> Transições e animações suaves
                  </span>
                }
                hint="Ativa animações fluidas na abertura de janelas, barras de progresso e cartões por todo o sistema. Desmarque se preferir uma navegação simplificada sem animações."
                checked={!preferences.reducedMotion}
                onChange={(checked) => setPreferences({ ...preferences, reducedMotion: !checked })}
              />
            </div>
          </Card>
        )}

        {activeTab === 'notifications' && (
          <Card className="p-6 space-y-6 animate-in fade-in duration-200">
            <SectionTitle>Notificações & Alertas de Conta</SectionTitle>
            <p className="text-sm text-ink-500">
              Escolha quais comunicados e relatórios automáticos você deseja receber no seu e-mail principal ({user.email}).
            </p>

            <div className="space-y-4 divide-y divide-line/60">
              <div className="pt-3 first:pt-0">
                <ToggleRow
                  id="billing-alerts"
                  label="Alertas de Fatura e Cobrança Stripe"
                  hint="Receba notificações de renovação de plano, notas fiscais emitidas e relatórios mensais de consumo dos seus workspaces."
                  checked={preferences.billingAlerts}
                  onChange={(checked) => setPreferences({ ...preferences, billingAlerts: checked })}
                />
              </div>

              <div className="pt-4">
                <ToggleRow
                  id="security-alerts"
                  label="Novos acessos à conta"
                  hint="Receba um aviso no Vianova e por email quando um navegador ainda não reconhecido entrar na sua conta. Mudanças críticas de senha e 2FA continuam sendo informadas."
                  checked={preferences.securityAlerts}
                  onChange={(checked) => setPreferences({ ...preferences, securityAlerts: checked })}
                />
              </div>

              <div className="pt-4">
                <ToggleRow
                  id="marketing-emails"
                  label="Novidades e Lançamentos do Ecossistema"
                  hint="Fique por dentro de novas funcionalidades, melhorias no Naia Campanhas/CRM e recursos de IA assistida."
                  checked={preferences.marketingEmails}
                  onChange={(checked) => setPreferences({ ...preferences, marketingEmails: checked })}
                />
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'apps' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <Card className="p-6 space-y-5">
              <SectionTitle>Aplicativos Conectados</SectionTitle>
              <p className="text-sm text-ink-500">
                Produtos conectados à sua conta Vianova.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-line bg-surface flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-base text-ink-900">Naia Campanhas</span>
                    <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded bg-emerald-100 text-emerald-800">
                      Conectado
                    </span>
                  </div>
                  <p className="text-xs text-ink-500">
                    Disparo de mensagens em massa, gestão de contatos e automação multicanal.
                  </p>
                  <a
                    href="http://localhost:3001"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-via-600 hover:text-via-700"
                  >
                    Abrir Naia Campanhas <ExternalLink size={13} />
                  </a>
                </div>

                <div className="p-4 rounded-xl border border-line bg-surface flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-base text-ink-900">Naia CRM & Atendimento</span>
                    <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded bg-emerald-100 text-emerald-800">
                      Conectado
                    </span>
                  </div>
                  <p className="text-xs text-ink-500">
                    Gestão de leads, funis de vendas e atendimento ao cliente em tempo real.
                  </p>
                  <a
                    href="http://localhost:3002"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-via-600 hover:text-via-700"
                  >
                    Abrir Naia CRM <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-5 border-amber-200 bg-amber-50/20">
              <div className="flex items-center gap-2 text-amber-800 font-display font-bold text-lg">
                <Info size={20} className="text-amber-600" />
                <span>Exportação de Dados da Conta</span>
              </div>
              <p className="text-sm text-ink-600 leading-relaxed">
                Você pode fazer o download de todas as suas informações pessoais e configurações armazenadas no Vianova em formato estruturado a qualquer momento.
              </p>

              {exported && (
                <div className="p-3 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <Check size={16} className="text-emerald-700" /> Download do arquivo de exportação iniciado!
                </div>
              )}

              <Button type="button" variant="secondary" onClick={handleExportData} className="inline-flex items-center gap-2 font-semibold">
                <Download size={16} /> Exportar dados da minha conta
              </Button>
            </Card>

            <Card className="p-6 space-y-4 border-line bg-paper/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-display font-bold text-base text-ink-900">Encerramento e Segurança da Conta</h3>
                  <p className="text-sm text-ink-500 mt-1">
                    As opções de encerramento da conta (carência de 15 dias), alteração de senha e sessões ativas são gerenciadas na área de Segurança.
                  </p>
                </div>
                <Link
                  to="/security"
                  className="shrink-0 text-sm font-bold text-via-600 hover:text-via-700 bg-via-50 px-4 py-2 rounded-ctrl border border-via-200 text-center w-full sm:w-auto"
                >
                  Ir para Segurança ›
                </Link>
              </div>
            </Card>
          </div>
        )}

        {activeTab !== 'apps' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-line">
            <div className="text-sm w-full sm:w-auto">
              {error && <ErrorNote>{error}</ErrorNote>}
              {saved && <span className="text-emerald-600 font-bold inline-flex items-center gap-1.5"><Check size={16} /> Alterações de perfil salvas com sucesso!</span>}
            </div>
            <Button type="submit" loading={loading} className="font-bold px-6 shadow-xs w-full sm:w-auto">
              Salvar alterações
            </Button>
          </div>
        )}
      </form>

      {avatarFile && (
        <AvatarCropper
          file={avatarFile}
          onClose={() => setAvatarFile(null)}
          onConfirm={handleUpload}
        />
      )}

      <section className="space-y-3 pt-4 border-t border-line">
        <SectionTitle>Métodos de Acesso</SectionTitle>
        <Card className="divide-y divide-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-bold text-ink-900">E-mail e senha</p>
              <p className="text-xs text-ink-500 font-mono mt-0.5">{user.email}</p>
            </div>
            <span className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
              <StatusDot tone="ok" /> Ativo
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-bold text-ink-900">Verificação em duas etapas</p>
              <p className="text-xs text-ink-500 mt-0.5">
                Camada adicional de proteção por aplicativo autenticador ao entrar.
              </p>
            </div>
            {user.twoFactorEnabled ? (
              <span className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                <StatusDot tone="ok" /> Ativa
              </span>
            ) : (
              <Link
                to="/security"
                className="text-sm font-bold text-via-600 hover:text-via-700 bg-via-50 px-3 py-1.5 rounded-ctrl border border-via-200 self-start sm:self-auto text-center"
              >
                Configurar ›
              </Link>
            )}
          </div>
        </Card>
      </section>

    </div>
  )
}

function parseLocationString(loc: string) {
  if (!loc) return { country: 'Brasil', stateUF: '', cityName: '' }
  const parts = loc.split(' - ')
  if (parts.length === 2) {
    const countryPart = parts[1].trim()
    const cityState = parts[0].split(', ')
    if (cityState.length === 2) {
      return { country: countryPart, cityName: cityState[0].trim(), stateUF: cityState[1].trim() }
    }
    return { country: countryPart, cityName: parts[0].trim(), stateUF: '' }
  }
  return { country: 'Brasil', cityName: loc, stateUF: '' }
}

type IbgeState = { id: number; sigla: string; nome: string }
type IbgeCity = { id: number; nome: string }

function LocationSelector({ location, onChangeLocation }: { location: string; onChangeLocation: (val: string) => void }) {
  const initial = parseLocationString(location)
  const [country, setCountry] = useState(initial.country)
  const [stateUF, setStateUF] = useState(initial.stateUF)
  const [cityName, setCityName] = useState(initial.cityName)

  const [states, setStates] = useState<IbgeState[]>([])
  const [cities, setCities] = useState<IbgeCity[]>([])
  const [loadingStates, setLoadingStates] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)

  useEffect(() => {
    if (country !== 'Brasil') return
    let active = true
    setLoadingStates(true)
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then((res) => res.json())
      .then((data: IbgeState[]) => {
        if (active) setStates(data)
      })
      .catch((err) => console.error('Erro ao buscar estados IBGE:', err))
      .finally(() => {
        if (active) setLoadingStates(false)
      })
    return () => { active = false }
  }, [country])

  useEffect(() => {
    if (country !== 'Brasil' || !stateUF) {
      setCities([])
      return
    }
    let active = true
    setLoadingCities(true)
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateUF}/municipios?orderBy=nome`)
      .then((res) => res.json())
      .then((data: IbgeCity[]) => {
        if (active) setCities(data)
      })
      .catch((err) => console.error('Erro ao buscar municípios IBGE:', err))
      .finally(() => {
        if (active) setLoadingCities(false)
      })
    return () => { active = false }
  }, [country, stateUF])

  useEffect(() => {
    if (country === 'Brasil') {
      if (cityName && stateUF) {
        onChangeLocation(`${cityName}, ${stateUF} - Brasil`)
      } else if (stateUF) {
        onChangeLocation(`${stateUF} - Brasil`)
      } else {
        onChangeLocation(country)
      }
    } else {
      if (cityName && stateUF) {
        onChangeLocation(`${cityName}, ${stateUF} - ${country}`)
      } else if (cityName) {
        onChangeLocation(`${cityName} - ${country}`)
      } else {
        onChangeLocation(country)
      }
    }
  }, [country, stateUF, cityName])

  return (
    <div className="space-y-4 pt-2 border-t border-line">
      <div>
        <span className="block text-sm font-bold text-ink-800 mb-1">Localização Principal (País, Estado e Cidade)</span>
        <p className="text-xs text-ink-500">
          Selecione sua região com precisão. Para o Brasil, os dados são alimentados em tempo real via API pública do IBGE.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {}
        <Field label="País" htmlFor="country">
          <select
            id="country"
            value={country}
            onChange={(e) => {
              const newCountry = e.target.value
              setCountry(newCountry)
              if (newCountry !== 'Brasil') {
                setStateUF('')
                setCityName('')
              }
            }}
            className="w-full h-10 px-3 rounded-ctrl border border-line bg-white text-sm font-medium"
          >
            <option value="Brasil">Brasil</option>
            <option value="Portugal">Portugal</option>
            <option value="Estados Unidos">Estados Unidos</option>
            <option value="Espanha">Espanha</option>
            <option value="Reino Unido">Reino Unido</option>
            <option value="Canadá">Canadá</option>
            <option value="Argentina">Argentina</option>
            <option value="Colômbia">Colômbia</option>
            <option value="México">México</option>
            <option value="Outro">Outro</option>
          </select>
        </Field>

        {}
        {country === 'Brasil' ? (
          <Field label="Estado (UF)" htmlFor="stateUF">
            <select
              id="stateUF"
              value={stateUF}
              onChange={(e) => {
                setStateUF(e.target.value)
                setCityName('')
              }}
              disabled={loadingStates}
              className="w-full h-10 px-3 rounded-ctrl border border-line bg-white text-sm font-medium disabled:bg-paper"
            >
              <option value="">Selecione o Estado...</option>
              {states.map((s) => (
                <option key={s.id} value={s.sigla}>
                  {s.nome} ({s.sigla})
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Estado / Província" htmlFor="stateUF">
            <input
              id="stateUF"
              type="text"
              value={stateUF}
              onChange={(e) => setStateUF(e.target.value)}
              placeholder="Ex.: Califórnia, Lisboa"
              className="w-full"
            />
          </Field>
        )}

        {}
        {country === 'Brasil' ? (
          <Field label="Cidade" htmlFor="cityName">
            <select
              id="cityName"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              disabled={!stateUF || loadingCities}
              className="w-full h-10 px-3 rounded-ctrl border border-line bg-white text-sm font-medium disabled:bg-paper"
            >
              <option value="">{loadingCities ? 'Carregando cidades...' : !stateUF ? 'Selecione a UF primeiro' : 'Selecione a Cidade...'}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Cidade" htmlFor="cityName">
            <input
              id="cityName"
              type="text"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              placeholder="Ex.: Miami, Porto"
              className="w-full"
            />
          </Field>
        )}
      </div>
    </div>
  )
}
