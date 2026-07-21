import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { CalendarClock, HardDrive, Package, Undo2, Upload, Users, Link2, Zap, Megaphone, Workflow } from 'lucide-react'
import { api } from '../../lib/api'
import { Button, Card, ErrorNote, StatusDot } from '../../components/ui'
import { createHeadConfig } from '../../lib/seo'

export const Route = createFileRoute('/_app/billing')({ head: () => createHeadConfig('Cobrança — Vianova'),
  component: BillingPage,
})

type Overview = {
  organizations: { id: string; name: string }[]
  subscriptions: {
    subscription: {
      id: string
      workspaceId: string
      workspaceName: string | null
      organizationId: string | null
      status: string
      cancelAtPeriodEnd: boolean
      stripeSubscriptionId: string | null
      currentPeriodEnd: string | Date | null
    }
    plan: {
      id: string
      name: string
      tier: string
      priceCents: number
      limits: Record<string, number>
    } | null
    product: { slug: string; name: string; webUrl: string }
    addons: {
      id: string
      addonTypeId: string
      name: string
      quantity: number
      unitLabel: string | null
      priceCents: number
      limitsPerUnit: Record<string, number>
    }[]
    invoices: {
      id: string
      status: string
      amountPaidCents: number
      hostedInvoiceUrl: string | null
    }[]
    usage?: Record<string, number> | null
  }[]
}

function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log10(bytes) / Math.log10(1024))
  const value = bytes / 1024 ** i
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

const limitLabels: Record<string, string> = {
  seats: 'Assentos',
  connections: 'Conexões',
  creditsPerCycle: 'Créditos/ciclo',
  campaignsPerMonth: 'Campanhas/mês',
  automations: 'Automações',
  storageBytes: 'Armazenamento',
  maxFileSizeBytes: 'Tamanho máx. por arquivo',
}

const limitIcons: Record<string, typeof Users> = {
  seats: Users,
  connections: Link2,
  creditsPerCycle: Zap,
  campaignsPerMonth: Megaphone,
  automations: Workflow,
  storageBytes: HardDrive,
  maxFileSizeBytes: Upload,
}

const limitOrder = ['seats', 'connections', 'creditsPerCycle', 'campaignsPerMonth', 'automations', 'storageBytes', 'maxFileSizeBytes']

function formatLimitValue(key: string, value: number): string {
  if (key === 'storageBytes' || key === 'maxFileSizeBytes') {
    return formatBytes(value)
  }
  if (key === 'automations' && value < 0) return 'ilimitado'
  return value.toLocaleString('pt-BR')
}

const statusInfo: Record<string, { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' }> = {
  active: { label: 'Ativa', tone: 'ok' },
  past_due: { label: 'Pagamento pendente', tone: 'warn' },
  canceled: { label: 'Cancelada', tone: 'danger' },
  none: { label: 'Sem plano', tone: 'muted' },
}

function BillingPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error: apiError } = await api.billing.overview.get()
    if (apiError || !data || !('subscriptions' in data)) {
      setError('Não foi possível carregar suas assinaturas. Recarregue a página.')
      return
    }
    setOverview(data as Overview)
  }

  useEffect(() => {
    load()
  }, [])

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!overview) return <p className="text-sm text-ink-500 animate-pulse">Carregando faturas e uso em tempo real…</p>

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">Assinaturas e Consumo</h1>
        <p className="mt-1 text-sm text-ink-500">
          Acompanhe as assinaturas e o consumo dos seus workspaces. O checkout de um novo plano acontece dentro de cada produto.
        </p>
      </div>

      {overview.subscriptions.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <h2 className="font-display text-lg font-bold">Nenhuma assinatura ativa</h2>
          <p className="text-sm text-ink-500 max-w-md mx-auto">
            Acesse o Naia Campanhas e assine um plano para o seu workspace. Os dados aparecerão aqui.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {overview.subscriptions.map((item) => (
            <SubscriptionCard key={item.subscription.id} item={item} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  )
}

function SubscriptionCard({
  item,
  onChanged,
}: {
  item: Overview['subscriptions'][number]
  onChanged: () => Promise<void>
}) {
  const [portalError, setPortalError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const status = statusInfo[item.subscription.status] ?? statusInfo.none

  const paidActive =
    Boolean(item.subscription.stripeSubscriptionId) &&
    ['active', 'past_due', 'trialing'].includes(item.subscription.status)

  const monthlyTotalCents =
    (item.plan?.priceCents ?? 0) +
    item.addons.reduce((sum, addon) => sum + addon.priceCents * addon.quantity, 0)

  // Limites efetivos = plano + add-ons, igual ao entitlement sincronizado.
  const effectiveLimits: Record<string, number> = { ...(item.plan?.limits ?? {}) }
  for (const addon of item.addons) {
    for (const [key, perUnit] of Object.entries(addon.limitsPerUnit)) {
      effectiveLimits[key] = (effectiveLimits[key] ?? 0) + perUnit * addon.quantity
    }
  }

  async function openPortal() {
    setPortalError(null)
    const { data, error } = await api.billing
      .subscriptions({ id: item.subscription.id })
      .portal.post()
    if (error || !data || !('portalUrl' in data)) {
      setPortalError(
        (error?.value as { message?: string })?.message ?? 'Não foi possível abrir o portal.',
      )
      return
    }
    window.location.href = data.portalUrl!
  }

  async function removeAddon(addonTypeId: string) {
    setBusy(`addon:${addonTypeId}`)
    setPortalError(null)
    setConfirming(null)
    const { error } = await api.billing
      .subscriptions({ id: item.subscription.id })
      .addons({ addonTypeId })
      .patch({ quantity: 0 })
    setBusy(null)
    if (error) {
      setPortalError((error.value as { message?: string })?.message ?? 'Não foi possível remover o add-on.')
      return
    }
    await onChanged()
  }

  async function cancelSubscription() {
    setBusy('cancel')
    setPortalError(null)
    setConfirming(null)
    const { error } = await api.billing.subscriptions({ id: item.subscription.id }).cancel.post()
    setBusy(null)
    if (error) {
      setPortalError((error.value as { message?: string })?.message ?? 'Não foi possível cancelar.')
      return
    }
    await onChanged()
  }

  async function resumeSubscription() {
    setBusy('resume')
    setPortalError(null)
    const { error } = await api.billing.subscriptions({ id: item.subscription.id }).resume.post()
    setBusy(null)
    if (error) {
      setPortalError((error.value as { message?: string })?.message ?? 'Não foi possível retomar.')
      return
    }
    await onChanged()
  }

  return (
    <Card className="p-6 space-y-6 border border-line shadow-xs hover:shadow-md transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="font-display text-xl font-bold text-ink-900">{item.product.name}</h3>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-paper border border-line">
              <StatusDot tone={status.tone} /> {status.label}
            </span>
          </div>
          <p className="text-sm text-ink-500 mt-1">
            Workspace: <span className="font-mono font-medium text-ink-800 bg-paper px-2 py-0.5 rounded border border-line">{item.subscription.workspaceName ?? item.subscription.workspaceId}</span>
          </p>
        </div>
        <Button variant="secondary" onClick={openPortal} className="shrink-0 font-medium">
          Portal Stripe de Faturas
        </Button>
      </div>

      {portalError && <ErrorNote>{portalError}</ErrorNote>}

      {item.plan && (
        <div className="space-y-4 pt-2 border-t border-line/60">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-baseline gap-2.5 flex-wrap text-sm">
              <span className="font-bold text-ink-900 uppercase tracking-wide text-xs">Plano:</span>
              <span className="font-semibold text-via-600 bg-via-500/10 px-2.5 py-0.5 rounded text-sm">
                {item.plan.name}
              </span>
              {monthlyTotalCents > 0 && (
                <span className="text-ink-500 text-xs">
                  {formatPrice(monthlyTotalCents)}/mês
                  {item.addons.length > 0 && ' com add-ons'}
                </span>
              )}
              {paidActive && item.subscription.currentPeriodEnd && (
                <span className="text-ink-400 text-xs">
                  {item.subscription.cancelAtPeriodEnd
                    ? `· ativa até ${formatDate(item.subscription.currentPeriodEnd)}`
                    : `· renova em ${formatDate(item.subscription.currentPeriodEnd)}`}
                </span>
              )}
            </div>
            {item.usage && (
              <span className="text-xs text-emerald-600 font-medium inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> Consumo em tempo real
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {limitOrder
              .filter((key) => key in effectiveLimits)
              .map((key) => {
                const limit = effectiveLimits[key]!
                const isCapacity = key === 'storageBytes'
                const isLimitOnly = key === 'maxFileSizeBytes'
                const currentUsage = item.usage && isCapacity ? (item.usage[key] ?? 0) : null
                const percent = currentUsage !== null && limit > 0 ? Math.min(100, Math.round((currentUsage / limit) * 100)) : 0
                const Icon = limitIcons[key]
                return (
                <div key={key} className="bg-paper rounded-ctrl px-3.5 py-3 border border-line/70 flex flex-col justify-between shadow-2xs hover:border-via-500/40 transition-colors">
                  <div>
                    <div className="flex items-center gap-1.5 text-ink-500">
                      {Icon && <Icon size={13} aria-hidden="true" />}
                      <p className="text-[11px] font-bold uppercase tracking-wider">{limitLabels[key] ?? key}</p>
                    </div>
                    <p className="font-mono text-base font-bold text-ink-900 mt-1">
                      {isLimitOnly ? (
                        <span className="text-via-600">{formatLimitValue(key, limit)}</span>
                      ) : currentUsage !== null ? (
                        <>
                          <span className="text-via-600">{formatLimitValue(key, currentUsage)}</span>
                          <span className="text-ink-400 font-normal text-xs"> / {formatLimitValue(key, limit)}</span>
                        </>
                      ) : (
                        <span className="text-via-600">{formatLimitValue(key, limit)}</span>
                      )}
                    </p>
                  </div>
                  {isCapacity && currentUsage !== null && (
                    <div className="w-full bg-line/80 h-1.5 rounded-full overflow-hidden mt-3">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          percent > 85 ? 'bg-danger-600' : percent > 60 ? 'bg-warn-600' : 'bg-via-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {!item.usage && (
            <p className="text-xs text-ink-400 italic">
              Conecte ou acesse o produto para iniciar o censo automático dos limites do seu workspace.
            </p>
          )}

          {item.addons.length > 0 && (
            <div className="pt-4 border-t border-line/60 space-y-2">
              <p className="text-xs font-bold text-ink-900 uppercase tracking-wide">Add-ons ativos</p>
              <ul className="space-y-1.5">
                {item.addons.map((addon) => (
                  <li
                    key={addon.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-ctrl border border-line/70 bg-paper px-3.5 py-2.5"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-ctrl bg-via-500/10 text-via-600">
                      <Package size={15} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink-900">
                        {addon.quantity}× {addon.name}
                      </p>
                      <p className="text-xs text-ink-500">
                        {formatPrice(addon.priceCents * addon.quantity)}/mês
                        {addon.unitLabel ? ` (${formatPrice(addon.priceCents)} por ${addon.unitLabel})` : ''}
                      </p>
                    </div>
                    {confirming === `addon:${addon.addonTypeId}` ? (
                      <span className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0 w-full sm:w-auto">
                        <span className="text-xs text-ink-500 hidden sm:inline">
                          Sai da próxima fatura; o já pago vale até o fim do ciclo.
                        </span>
                        <Button
                          variant="danger"
                          className="h-8 px-3 text-xs w-full sm:w-auto"
                          loading={busy === `addon:${addon.addonTypeId}`}
                          onClick={() => removeAddon(addon.addonTypeId)}
                        >
                          Remover
                        </Button>
                        <button
                          onClick={() => setConfirming(null)}
                          className="text-xs font-medium text-ink-500 hover:text-ink-900 transition-colors text-center"
                        >
                          Voltar
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirming(`addon:${addon.addonTypeId}`)}
                        className="shrink-0 px-3 py-1.5 rounded-ctrl text-xs font-semibold text-danger-600 bg-danger-50 hover:bg-danger-600 hover:text-white transition-colors w-full sm:w-auto"
                      >
                        Remover
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {paidActive && (
            <div className="pt-4 border-t border-line/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {item.subscription.cancelAtPeriodEnd ? (
                <>
                  <p className="text-xs text-ink-500 flex items-center gap-1.5">
                    <CalendarClock size={13} className="text-amber-500 shrink-0" aria-hidden="true" />
                    Cancelamento agendado. O workspace volta ao plano grátis no fim do período.
                  </p>
                  <Button
                    variant="secondary"
                    className="h-8 px-3 text-xs gap-1.5 w-full sm:w-auto"
                    loading={busy === 'resume'}
                    onClick={resumeSubscription}
                  >
                    <Undo2 size={13} aria-hidden="true" />
                    Retomar assinatura
                  </Button>
                </>
              ) : confirming === 'cancel' ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto sm:ml-auto">
                  <span className="text-xs text-ink-500">
                    O plano segue ativo até o fim do período pago. Confirmar?
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="danger"
                      className="h-8 px-3 text-xs"
                      loading={busy === 'cancel'}
                      onClick={cancelSubscription}
                    >
                      Cancelar assinatura
                    </Button>
                    <button
                      onClick={() => setConfirming(null)}
                      className="text-xs font-medium text-ink-500 hover:text-ink-900 transition-colors"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming('cancel')}
                  className="sm:ml-auto px-3 py-1.5 rounded-ctrl text-xs font-semibold text-danger-600 bg-danger-50 hover:bg-danger-600 hover:text-white transition-colors w-full sm:w-auto"
                >
                  Cancelar assinatura
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

