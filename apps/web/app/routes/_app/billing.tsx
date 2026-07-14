import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { Button, Card, ErrorNote, SectionTitle, StatusDot } from '../../components/ui'

export const Route = createFileRoute('/_app/billing')({
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
      currentPeriodEnd: string | Date | null
    }
    plan: { id: string; name: string; tier: string; limits: Record<string, number> } | null
    product: { slug: string; name: string; webUrl: string }
    addons: { id: string; name: string; quantity: number; unitLabel: string | null }[]
    invoices: {
      id: string
      status: string
      amountPaidCents: number
      hostedInvoiceUrl: string | null
    }[]
  }[]
}

const limitLabels: Record<string, string> = {
  seats: 'Assentos',
  connections: 'Conexões',
  messagesPerMonth: 'Mensagens/mês',
  campaignsPerMonth: 'Campanhas/mês',
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
  if (!overview) return <p className="text-sm text-ink-500">Carregando…</p>

  const orgName = (id: string | null) =>
    overview.organizations.find((o) => o.id === id)?.name ?? null

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Assinaturas</h1>
        <p className="mt-1 text-sm text-ink-500">
          Planos e add-ons de todos os produtos, num lugar só. Cada workspace é o titular da sua
          assinatura.
        </p>
      </div>

      {overview.subscriptions.length === 0 ? (
        <Card className="p-10 text-center">
          <h2 className="font-display text-lg font-bold">Nenhuma assinatura ainda</h2>
          <p className="mt-1 text-sm text-ink-500">
            Quando você assinar um produto — ou criar um workspace num produto e assinar por lá —
            ele aparece aqui.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {overview.subscriptions.map((item) => (
            <SubscriptionCard key={item.subscription.id} item={item} orgName={orgName} />
          ))}
        </div>
      )}

      <SubscribeSection organizations={overview.organizations} onSubscribed={load} />
    </div>
  )
}

function SubscriptionCard({
  item,
  orgName,
}: {
  item: Overview['subscriptions'][number]
  orgName: (id: string | null) => string | null
}) {
  const [portalError, setPortalError] = useState<string | null>(null)
  const status = statusInfo[item.subscription.status] ?? statusInfo.none
  const organization = orgName(item.subscription.organizationId)

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

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-bold">{item.product.name}</h3>
            <span className="flex items-center gap-1.5 text-xs text-ink-500">
              <StatusDot tone={status.tone} /> {status.label}
            </span>
          </div>
          <p className="text-sm text-ink-500 mt-0.5">
            Workspace{' '}
            <span className="font-mono text-xs">
              {item.subscription.workspaceName ?? item.subscription.workspaceId}
            </span>
            {organization && <> · Organização {organization}</>}
          </p>
        </div>
        <Button variant="secondary" onClick={openPortal}>
          Gerenciar
        </Button>
      </div>

      {portalError && <ErrorNote>{portalError}</ErrorNote>}

      {item.plan && (
        <div>
          <p className="text-sm font-medium mb-2">
            Plano {item.plan.name}
            {item.addons.length > 0 && (
              <span className="text-ink-500 font-normal">
                {' '}
                + {item.addons.map((a) => `${a.quantity}× ${a.name}`).join(', ')}
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(item.plan.limits).map(([key, limit]) => (
              <div key={key} className="bg-paper rounded-ctrl px-3 py-2">
                <p className="text-xs text-ink-500">{limitLabels[key] ?? key}</p>
                <p className="font-mono text-sm font-medium">
                  <span className="text-ink-400">— de </span>
                  {limit.toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Uso aparece aqui quando o produto estiver conectado.
          </p>
        </div>
      )}
    </Card>
  )
}

// Assinar um produto direto pelo portal. Em produção o caminho comum é o
// inverso — o produto redireciona pra cá com o workspace dele.
function SubscribeSection({
  organizations,
  onSubscribed,
}: {
  organizations: { id: string; name: string }[]
  onSubscribed: () => void
}) {
  const [plans, setPlans] = useState<
    { id: string; name: string; tier: string; priceCents: number; limits: Record<string, number> }[]
  >([])
  const [productName, setProductName] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string>('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.products({ slug: 'naia' }).plans.get().then(({ data }) => {
      if (data && 'plans' in data && data.plans) {
        setPlans(data.plans)
        setProductName(data.product?.name ?? 'Naia')
      }
    })
  }, [])

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlan) {
      setError('Escolha um plano.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: apiError } = await api.billing.checkout.post({
        product_slug: 'naia',
        // Placeholder do Milestone 1: o workspace real passa a existir quando o
        // produto estiver de pé; até lá o ID é gerado aqui para testes.
        workspace_id: crypto.randomUUID(),
        workspace_name: workspaceName || undefined,
        plan_id: selectedPlan,
        organization_id: organizationId || undefined,
      })

      if (apiError) {
        setError(
          (apiError.value as { message?: string })?.message ?? 'Não foi possível assinar.',
        )
        return
      }

      if (data && 'checkoutUrl' in data && data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }

      onSubscribed()
    } finally {
      setLoading(false)
    }
  }

  if (plans.length === 0) return null

  return (
    <section className="space-y-3">
      <SectionTitle>Assinar {productName}</SectionTitle>
      <Card className="p-6">
        <form onSubmit={handleSubscribe} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlan(plan.id)}
                aria-pressed={selectedPlan === plan.id}
                className={`text-left rounded-card border p-4 transition-colors ${
                  selectedPlan === plan.id
                    ? 'border-via-600 ring-2 ring-via-100'
                    : 'border-line hover:border-line-strong'
                }`}
              >
                <p className="font-display font-bold">{plan.name}</p>
                <p className="font-mono text-sm mt-1">
                  {plan.priceCents === 0
                    ? 'R$ 0/mês'
                    : `R$ ${(plan.priceCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês`}
                </p>
                <ul className="mt-3 space-y-1 text-xs text-ink-500">
                  {Object.entries(plan.limits).map(([key, limit]) => (
                    <li key={key}>
                      {limit.toLocaleString('pt-BR')} {(limitLabels[key] ?? key).toLowerCase()}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ws-name">Nome do workspace</label>
              <input
                id="ws-name"
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Meu workspace"
              />
            </div>
            <div>
              <label htmlFor="org">Organização (opcional)</label>
              <select
                id="org"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="w-full h-10 px-3 rounded-ctrl border border-line-strong bg-surface text-ink-900 outline-none focus:border-via-600 focus:ring-2 focus:ring-via-100"
              >
                <option value="">Sem organização</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}

          <Button type="submit" loading={loading}>
            Assinar
          </Button>
        </form>
      </Card>
    </section>
  )
}
