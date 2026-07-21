import { createFileRoute, Link, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  CreditCard,
  Files,
  House,
  LayoutGrid,
  LogOut,
  MailWarning,
  Megaphone,
  MessagesSquare,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { getSession } from '../lib/auth'
import { api } from '../lib/api'
import { ViaLogo } from '../components/brand'
import { NotFoundEmbedded } from '../components/error-pages'
import { Avatar } from '../components/avatar'
import { MobileNav } from '../components/mobile-nav'
import { NotificationBell } from '../components/notifications'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const user = await getSession()
    if (!user) {
      throw redirect({ to: '/login', search: { redirect_uri: undefined } })
    }
    return { user }
  },
  component: AppLayout,
  notFoundComponent: NotFoundEmbedded,
})

export const navItems = [
  { to: '/', label: 'Início', icon: House, exact: true },
  { to: '/profile', label: 'Perfil', icon: UserRound },
  { to: '/security', label: 'Segurança', icon: ShieldCheck },
  { to: '/billing', label: 'Assinaturas', icon: CreditCard },
  { to: '/files', label: 'Arquivos', icon: Files },
] as const

function AppLayout() {
  const { user } = Route.useRouteContext()

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar user={user} />
      {!user.emailVerifiedAt && <VerifyEmailBanner email={user.email} />}
      <div className="flex-1 flex max-w-6xl w-full mx-auto">
        <aside className="hidden md:block w-52 shrink-0 border-r border-line py-8 pr-4">
          <nav aria-label="Conta" className="space-y-0.5">
            {navItems.map(({ icon: Icon, ...item }) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: 'exact' in item && item.exact }}
                className="group flex items-center gap-2.5 px-3 py-2 rounded-ctrl text-sm font-medium text-ink-700 hover:bg-surface hover:text-ink-900 transition-colors"
                activeProps={{ className: 'bg-surface text-via-700' }}
              >
                <Icon size={16} aria-hidden="true" className="shrink-0" />
                {item.label}
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

function VerifyEmailBanner({ email }: { email: string }) {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleResend() {
    setSending(true)
    try {
      await api.auth['resend-verification'].post({ email })
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <MailWarning size={16} aria-hidden="true" className="shrink-0 text-amber-600" />
        <p className="text-sm text-amber-900 flex-1 min-w-48">
          Confirme seu email para proteger sua conta. Enviamos um link para{' '}
          <strong className="font-semibold">{email}</strong>.
        </p>
        {sent ? (
          <span className="text-sm font-medium text-amber-700">Link reenviado. Confira sua caixa de entrada.</span>
        ) : (
          <button
            onClick={handleResend}
            disabled={sending}
            className="text-sm font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-2 disabled:opacity-60 transition-colors"
          >
            {sending ? 'Reenviando…' : 'Reenviar link'}
          </button>
        )}
      </div>
    </div>
  )
}

function Topbar({
  user,
}: {
  user: { name: string; avatarUrl?: string | null; avatarFrame?: string | null }
}) {
  const router = useRouter()

  async function handleLogout() {
    await api.auth.logout.post()
    router.navigate({ to: '/login', search: { redirect_uri: undefined } })
  }

  return (
    <header className="h-14 border-b border-line bg-surface">
      <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MobileNav items={navItems} />
          <Link to="/" aria-label="Início do Vianova">
            <ViaLogo size={26} />
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <ProductSwitcher />
          <Link
            to="/profile"
            aria-label={`Perfil de ${user.name}`}
            title={user.name}
            className="rounded-full transition-transform hover:scale-105 motion-reduce:hover:scale-100"
          >
            <Avatar
              name={user.name}
              avatarUrl={user.avatarUrl}
              frame={user.avatarFrame}
              size="md"
            />
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-ink-900 px-2 py-1 rounded-ctrl hover:bg-paper transition-colors"
          >
            <LogOut size={15} aria-hidden="true" />
            Sair
          </button>
        </div>
      </div>
    </header>
  )
}

const productIcons: Record<string, typeof Megaphone> = {
  naia: Megaphone,
  'naia-crm': MessagesSquare,
}

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
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Seus produtos"
        title="Seus produtos"
        className={`grid size-9 place-items-center rounded-ctrl text-ink-500 transition-colors hover:bg-paper hover:text-ink-900 ${open ? 'bg-paper text-via-700' : ''}`}
      >
        <LayoutGrid size={18} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-72 origin-top-right bg-surface border border-line rounded-card shadow-lg shadow-ink-900/5 p-2 z-20 animate-in"
        >
          <p className="px-3 pt-1.5 pb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
            Seus produtos
          </p>
          {products.map((product) => {
            const Icon = productIcons[product.slug] ?? LayoutGrid
            return (
              <a
                key={product.slug}
                role="menuitem"
                href={product.webUrl}
                className="flex items-start gap-3 px-3 py-2.5 rounded-ctrl hover:bg-paper transition-colors"
              >
                <span className="mt-0.5 grid size-8 place-items-center rounded-ctrl bg-via-600 text-white">
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink-900">{product.name}</span>
                  {product.description && (
                    <span className="block text-xs text-ink-500 truncate">
                      {product.description}
                    </span>
                  )}
                </span>
              </a>
            )
          })}
          {products.length === 0 && (
            <p className="px-3 py-2.5 text-sm text-ink-500">Nenhum produto disponível.</p>
          )}
        </div>
      )}
    </div>
  )
}
