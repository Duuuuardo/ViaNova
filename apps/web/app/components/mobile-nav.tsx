import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface MobileNavItem {
  to: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

export function MobileNav({ items }: { items: readonly MobileNavItem[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [open])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="md:hidden inline-flex items-center justify-center size-9 rounded-ctrl text-ink-500 hover:bg-paper hover:text-ink-900 transition-colors"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navegação da conta"
          className="fixed inset-0 z-40 md:hidden"
        >
          <div
            className="absolute inset-0 bg-ink-900/30 backdrop-blur-xs motion-safe:animate-[fade-in_200ms_ease-out]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 bottom-0 w-64 max-w-[80vw] bg-surface border-r border-line shadow-xl motion-safe:animate-[drawer-in_200ms_ease-out] flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-line">
              <span className="font-display text-sm font-bold text-ink-900">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="inline-flex items-center justify-center size-8 rounded-ctrl text-ink-500 hover:bg-paper hover:text-ink-900 transition-colors"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {items.map(({ icon: Icon, ...item }) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.exact }}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-ctrl text-sm font-medium text-ink-700 hover:bg-paper hover:text-ink-900 transition-colors"
                  activeProps={{ className: 'bg-surface text-via-700' }}
                >
                  <Icon size={18} aria-hidden="true" className="shrink-0" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
