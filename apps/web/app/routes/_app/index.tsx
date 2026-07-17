import { createFileRoute, Link, getRouteApi } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ExternalLink, FolderKanban } from 'lucide-react'
import { api } from '../../lib/api'
import { Card, SectionTitle } from '../../components/ui'

export const Route = createFileRoute('/_app/')({
  component: HomePage,
})

const appRoute = getRouteApi('/_app')

type OverviewSubscription = {
  subscription: {
    id: string
    workspaceId: string
    workspaceName: string | null
    status: string
    cancelAtPeriodEnd: boolean
  }
  plan: { name: string; tier: string } | null
  product: { slug: string; name: string; webUrl: string }
}

function HomePage() {
  const { user } = appRoute.useRouteContext()
  const [products, setProducts] = useState<
    { slug: string; name: string; description: string | null; domain: string; webUrl: string }[]
  >([])
  const [workspaces, setWorkspaces] = useState<OverviewSubscription[]>([])

  useEffect(() => {
    api.products.get().then(({ data }) => {
      if (data?.products) setProducts(data.products)
    })
    api.billing.overview.get().then(({ data }) => {
      if (data && 'subscriptions' in data) setWorkspaces(data.subscriptions as OverviewSubscription[])
    })
  }, [])

  const workspacesByProduct = workspaces.reduce<Map<string, OverviewSubscription[]>>((acc, row) => {
    const list = acc.get(row.product.slug) ?? []
    list.push(row)
    acc.set(row.product.slug, list)
    return acc
  }, new Map())

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Olá, {user.name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-ink-500">
          Sua conta Vianova é o ponto de partida para todos os produtos.
        </p>
      </div>

      <section className="space-y-3">
        <SectionTitle>Produtos</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {products.map((product) => (
            <a key={product.slug} href={product.webUrl} className="group">
              <Card className="p-6 h-full transition-colors group-hover:border-via-600">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-ctrl bg-via-50 font-display text-lg font-bold text-via-700 uppercase">
                    {product.name[0]}
                  </span>
                  <span className="text-ink-400 group-hover:text-via-600 transition-colors" aria-hidden="true">
                    →
                  </span>
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{product.name}</h3>
                <p className="mt-1 text-sm text-ink-500">{product.description}</p>
                <p className="mt-3 text-xs font-mono text-ink-400">{product.domain}</p>
              </Card>
            </a>
          ))}
        </div>
      </section>

      {workspacesByProduct.size > 0 && (
        <section className="space-y-3">
          <SectionTitle>Seus workspaces</SectionTitle>
          <div className="space-y-5">
            {[...workspacesByProduct.entries()].map(([slug, rows]) => (
              <div key={slug}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
                  {rows[0].product.name}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {rows.map((row) => (
                    <Card key={row.subscription.id} className="p-4 flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-ctrl bg-via-50 text-via-700">
                        <FolderKanban size={17} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {row.subscription.workspaceName ?? row.subscription.workspaceId}
                        </p>
                        <p className="text-xs text-ink-500">
                          Plano {row.plan?.name ?? '—'}
                          {row.subscription.cancelAtPeriodEnd
                            ? ' · cancelamento agendado'
                            : row.subscription.status !== 'active'
                              ? ` · ${row.subscription.status}`
                              : ''}
                        </p>
                      </div>
                      <a
                        href={row.product.webUrl}
                        aria-label={`Abrir ${row.product.name}`}
                        className="shrink-0 text-ink-400 hover:text-via-600 transition-colors"
                      >
                        <ExternalLink size={15} aria-hidden="true" />
                      </a>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle>Atalhos</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link to="/profile" className="text-sm font-medium text-via-600 hover:text-via-700">
            Gerenciar perfil e preferências ›
          </Link>
          <Link to="/security" className="text-sm font-medium text-via-600 hover:text-via-700">
            Ativar verificação em duas etapas ›
          </Link>
          <Link to="/billing" className="text-sm font-medium text-via-600 hover:text-via-700">
            Ver assinaturas e consumo ›
          </Link>
        </div>
      </section>
    </div>
  )
}
