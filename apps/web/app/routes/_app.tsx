import { createFileRoute, Link, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { getSession } from '../lib/auth'
import { api } from '../lib/api'
import { ViaLogo } from '../components/brand'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const user = await getSession()
    if (!user) {
      throw redirect({ to: '/login', search: { redirect_uri: undefined } })
    }
    return { user }
  },
  component: AppLayout,
})

const navItems = [
  { to: '/', label: 'Início', exact: true },
  { to: '/profile', label: 'Perfil' },
  { to: '/security', label: 'Segurança' },
  { to: '/organizations', label: 'Organizações' },
  { to: '/billing', label: 'Assinaturas' },
] as const

function AppLayout() {
  const { user } = Route.useRouteContext()

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar userName={user.name} />
      <div className="flex-1 flex max-w-6xl w-full mx-auto">
        <aside className="hidden md:block w-52 shrink-0 border-r border-line py-8 pr-4">
          <nav aria-label="Conta" className="space-y-0.5">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: 'exact' in item && item.exact }}
                className="group flex items-center justify-between px-3 py-2 rounded-ctrl text-sm font-medium text-ink-700 hover:bg-surface hover:text-ink-900"
                activeProps={{ className: 'bg-surface text-via-700' }}
              >
                {item.label}
                <span className="text-ink-400 opacity-0 group-hover:opacity-100" aria-hidden="true">
                  ›
                </span>
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-w-0 py-8 px-4 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Topbar({ userName }: { userName: string }) {
  const router = useRouter()

  async function handleLogout() {
    await api.auth.logout.post()
    router.navigate({ to: '/login', search: { redirect_uri: undefined } })
  }

  return (
    <header className="h-14 border-b border-line bg-surface">
      <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link to="/" aria-label="Início do Vianova">
            <ViaLogo />
          </Link>
          <ProductSwitcher />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-ink-500">{userName}</span>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-ink-700 hover:text-ink-900 px-2 py-1 rounded-ctrl hover:bg-paper"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  )
}

// Product switcher: os destinos do ecossistema. Trocar de produto não pede
// novo login — o produto redireciona pro /oidc/authorize já autenticado.
function ProductSwitcher() {
  const [open, setOpen] = useState(false)
  const [products, setProducts] = useState<
    { slug: string; name: string; description: string | null; webUrl: string }[]
  >([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.products.get().then(({ data }) => {
      if (data?.products) setProducts(data.products)
    })
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-ink-900 px-2 py-1 rounded-ctrl hover:bg-paper"
      >
        Produtos
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m2 3.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 w-72 bg-surface border border-line rounded-card shadow-lg shadow-ink-900/5 p-2 z-20"
        >
          {products.map((product) => (
            <a
              key={product.slug}
              role="menuitem"
              href={product.webUrl}
              className="flex items-start gap-3 px-3 py-2.5 rounded-ctrl hover:bg-paper"
            >
              <span className="mt-0.5 flex size-8 items-center justify-center rounded-ctrl bg-via-50 font-display font-bold text-via-700 uppercase">
                {product.name[0]}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-900">{product.name}</span>
                {product.description && (
                  <span className="block text-xs text-ink-500 truncate">{product.description}</span>
                )}
              </span>
            </a>
          ))}
          {products.length === 0 && (
            <p className="px-3 py-2.5 text-sm text-ink-500">Nenhum produto disponível.</p>
          )}
        </div>
      )}
    </div>
  )
}
