import { createFileRoute, Link, getRouteApi } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { Card, SectionTitle } from '../../components/ui'

export const Route = createFileRoute('/_app/')({
  component: HomePage,
})

const appRoute = getRouteApi('/_app')

function HomePage() {
  const { user } = appRoute.useRouteContext()
  const [products, setProducts] = useState<
    { slug: string; name: string; description: string | null; domain: string; webUrl: string }[]
  >([])

  useEffect(() => {
    api.products.get().then(({ data }) => {
      if (data?.products) setProducts(data.products)
    })
  }, [])

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

      <section className="space-y-3">
        <SectionTitle>Atalhos</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link to="/security" className="text-sm font-medium text-via-600 hover:text-via-700">
            Ativar verificação em duas etapas ›
          </Link>
          <Link to="/organizations" className="text-sm font-medium text-via-600 hover:text-via-700">
            Criar uma organização ›
          </Link>
          <Link to="/billing" className="text-sm font-medium text-via-600 hover:text-via-700">
            Ver assinaturas ›
          </Link>
        </div>
      </section>
    </div>
  )
}
