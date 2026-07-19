import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Bell, CheckCheck, ExternalLink, Loader2, ArrowLeft } from 'lucide-react'
import { api } from '../../lib/api'
import { Button, Card } from '../../components/ui'

export const Route = createFileRoute('/_app/notifications')({
  component: NotificationsPage,
})

type NotificationItem = {
  id: string
  type: string
  source: string
  sourceProductSlug: string | null
  sourceWorkspaceName: string | null
  title: string
  body: string | null
  actionUrl: string | null
  actionLabel: string | null
  readAt: Date | null
  createdAt: Date
}

const sourceLabel: Record<string, string> = {
  vianova: 'Vianova',
  naia: 'Naia Campanhas',
  'naia-crm': 'Naia CRM',
}

const typeLabel: Record<string, string> = {
  billing: 'Fatura',
  security: 'Segurança',
  product: 'Produto',
  marketing: 'Novidades',
}

const typeBadge: Record<string, string> = {
  billing: 'bg-via-100 text-via-800 border-via-200',
  security: 'bg-amber-100 text-amber-800 border-amber-200',
  product: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  marketing: 'bg-sky-100 text-sky-800 border-sky-200',
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState<string | 'all' | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  async function load(nextPage = 1, append = false) {
    setLoading(true)
    try {
      const { data } = await api.notifications.get({ query: { page: nextPage } })
      if (data?.notifications) {
        const list = data.notifications as NotificationItem[]
        setItems((prev) => (append ? [...prev, ...list] : list))
        setHasMore(data.hasMore)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1, false)
  }, [])

  async function markRead(id: string) {
    setMarking(id)
    try {
      await api.notifications({ id }).read.post()
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n)),
      )
    } finally {
      setMarking(null)
    }
  }

  async function markAllRead() {
    setMarking('all')
    try {
      await api['notifications']['read-all'].post()
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })))
    } finally {
      setMarking(null)
    }
  }

  const unreadCount = items.filter((n) => !n.readAt).length

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <div className="flex items-center gap-2 text-sm text-ink-500 mb-1">
            <Link to="/" className="hover:text-via-600 inline-flex items-center gap-1">
              <ArrowLeft size={14} /> Início
            </Link>
            <span>/</span>
            <span>Central de notificações</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">
            Notificações
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Alertas da sua conta Vianova e dos produtos conectados.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            type="button"
            variant="secondary"
            onClick={markAllRead}
            loading={marking === 'all'}
            className="shrink-0 inline-flex items-center gap-2"
          >
            <CheckCheck size={16} /> Marcar todas como lidas
          </Button>
        )}
      </div>

      {loading && items.length === 0 && (
        <Card className="py-16 flex flex-col items-center justify-center text-ink-400">
          <Loader2 size={28} className="animate-spin mb-3" />
          <p className="text-sm">Carregando notificações...</p>
        </Card>
      )}

      {!loading && items.length === 0 && (
        <Card className="py-16 flex flex-col items-center justify-center text-center">
          <Bell size={40} className="text-ink-300 mb-4" />
          <h2 className="text-lg font-bold text-ink-900">Nenhuma notificação</h2>
          <p className="text-sm text-ink-500 mt-1 max-w-sm">
            Quando acontecerem eventos importantes na sua conta ou nos produtos conectados, eles aparecem aqui.
          </p>
        </Card>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((n) => (
            <Card
              key={n.id}
              className={`p-4 flex flex-col sm:flex-row sm:items-start gap-4 transition-colors ${
                !n.readAt ? 'bg-via-500/[0.02] border-via-200' : ''
              }`}
            >
              <div className="shrink-0">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    typeBadge[n.type] ?? 'bg-ink-100 text-ink-700 border-ink-200'
                  }`}
                >
                  {typeLabel[n.type] ?? n.type}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className={`text-sm ${!n.readAt ? 'font-bold text-ink-900' : 'font-medium text-ink-800'}`}>
                  {n.title}
                </p>
                {n.body && <p className="text-sm text-ink-500 mt-1 leading-relaxed">{n.body}</p>}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-ink-400">
                  <span>{n.sourceWorkspaceName ?? sourceLabel[n.source] ?? n.source}</span>
                  <span>·</span>
                  <span>{n.createdAt.toLocaleString('pt-BR')}</span>
                </div>

                <div className="flex items-center gap-4 mt-3">
                  {n.actionUrl && (
                    <a
                      href={n.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-via-600 hover:text-via-700"
                    >
                      {n.actionLabel ?? 'Abrir'} <ExternalLink size={11} />
                    </a>
                  )}
                  {!n.readAt && (
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      disabled={marking === n.id}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-700 disabled:opacity-60"
                    >
                      {marking === n.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <CheckCheck size={11} />
                      )}
                      Marcar como lida
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {hasMore && (
            <div className="pt-2 flex justify-center">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const next = page + 1
                  setPage(next)
                  load(next, true)
                }}
                loading={loading}
              >
                Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
