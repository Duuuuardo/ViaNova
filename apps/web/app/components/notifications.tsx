import { useEffect, useRef, useState } from 'react'
import { Bell, Check, CheckCheck, ExternalLink, Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import { Link } from '@tanstack/react-router'

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

const typeDot: Record<string, string> = {
  billing: 'bg-via-500',
  security: 'bg-amber-500',
  product: 'bg-emerald-500',
  marketing: 'bg-sky-500',
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [marking, setMarking] = useState<string | 'all' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  async function load() {
    const [{ data: listData }, { data: countData }] = await Promise.all([
      api.notifications.get({ query: { page: 1 } }),
      api['notifications']['unread-count'].get(),
    ])
    if (listData?.notifications) setItems(listData.notifications)
    if (countData) setUnreadCount(countData.count ?? 0)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!open) return
    load()
  }, [open])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', onClickOutside)
      document.addEventListener('keydown', onEscape)
    }
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  async function markRead(id: string) {
    setMarking(id)
    try {
      await api.notifications({ id }).read.post()
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n)),
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } finally {
      setMarking(null)
    }
  }

  async function markAllRead() {
    setMarking('all')
    try {
      await api['notifications']['read-all'].post()
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })))
      setUnreadCount(0)
    } finally {
      setMarking(null)
    }
  }

  const unreadItems = items.filter((n) => !n.readAt)
  const readItems = items.filter((n) => n.readAt)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Notificações"
        title="Notificações"
        className={`relative grid size-9 place-items-center rounded-ctrl text-ink-500 transition-colors hover:bg-paper hover:text-ink-900 ${open ? 'bg-paper text-via-700' : ''}`}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-via-600 text-white text-[10px] font-bold border-2 border-surface">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 origin-top-right bg-surface border border-line rounded-card shadow-lg shadow-ink-900/5 z-20 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="text-sm font-bold text-ink-900">Notificações</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                disabled={marking === 'all'}
                className="flex items-center gap-1 text-xs font-semibold text-via-600 hover:text-via-700 disabled:opacity-60"
              >
                {marking === 'all' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <CheckCheck size={12} />
                )}
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && items.length === 0 && (
              <div className="py-8 flex justify-center">
                <Loader2 size={20} className="animate-spin text-ink-400" />
              </div>
            )}

            {items.length === 0 && !loading && (
              <div className="py-10 px-4 text-center">
                <Bell size={28} className="mx-auto text-ink-300 mb-2" />
                <p className="text-sm text-ink-500">Nenhuma notificação ainda.</p>
                <p className="text-xs text-ink-400 mt-1">
                  Aqui aparecem alertas da sua conta e dos produtos conectados.
                </p>
              </div>
            )}

            {unreadItems.length > 0 && (
              <div className="py-2">
                <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  Não lidas
                </p>
                {unreadItems.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onMarkRead={markRead}
                    marking={marking === n.id}
                  />
                ))}
              </div>
            )}

            {readItems.length > 0 && (
              <div className="py-2 border-t border-line">
                <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  Anteriores
                </p>
                {readItems.slice(0, 10).map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onMarkRead={markRead}
                    marking={marking === n.id}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-2 border-t border-line bg-paper/50">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-semibold text-via-600 hover:text-via-700"
            >
              Ver todas as notificações
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationRow({
  notification: n,
  onMarkRead,
  marking,
}: {
  notification: NotificationItem
  onMarkRead: (id: string) => void
  marking: boolean
}) {
  const isUnread = !n.readAt
  const source = n.sourceWorkspaceName
    ? `${sourceLabel[n.source] ?? n.source} · ${n.sourceWorkspaceName}`
    : sourceLabel[n.source] ?? n.source

  return (
    <div
      className={`px-4 py-3 flex gap-3 transition-colors ${isUnread ? 'bg-via-500/[0.03]' : ''}`}
    >
      <div className="mt-1 shrink-0">
        <span className={`block size-2 rounded-full ${typeDot[n.type] ?? 'bg-ink-300'}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${isUnread ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
          {n.title}
        </p>
        {n.body && <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{n.body}</p>}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-ink-400">{source}</span>
          <span className="text-[10px] text-ink-300">·</span>
          <span className="text-[10px] text-ink-400">
            {n.createdAt.toLocaleDateString('pt-BR')}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          {n.actionUrl && (
            <a
              href={n.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-via-600 hover:text-via-700"
            >
              {n.actionLabel ?? 'Abrir'} <ExternalLink size={11} />
            </a>
          )}
          {isUnread && (
            <button
              type="button"
              onClick={() => onMarkRead(n.id)}
              disabled={marking}
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-700 disabled:opacity-60"
            >
              {marking ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              Marcar como lida
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
