import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-via-600 text-white hover:bg-via-700',
  secondary: 'border border-line-strong bg-surface text-ink-900 hover:bg-paper',
  ghost: 'text-ink-700 hover:bg-paper',
  danger: 'bg-danger-600 text-white hover:opacity-90',
}

export function Button({
  variant = 'primary',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  loading?: boolean
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-ctrl text-sm font-semibold font-display transition-colors disabled:opacity-50 disabled:pointer-events-none ${buttonStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span
          className="size-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`bg-surface border border-line rounded-card ${className}`}>{children}</div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-ctrl bg-danger-50 border border-danger-600/25 px-3 py-2 text-sm text-danger-600"
    >
      {children}
    </div>
  )
}

export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string
  htmlFor: string
  children: ReactNode
  hint?: string
}) {
  return (
    <div>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-xs font-bold uppercase tracking-[0.12em] text-ink-500">
      {children}
    </h2>
  )
}

export function StatusDot({ tone }: { tone: 'ok' | 'warn' | 'danger' | 'muted' }) {
  const colors = {
    ok: 'bg-ok-600',
    warn: 'bg-warn-600',
    danger: 'bg-danger-600',
    muted: 'bg-ink-400',
  }
  return <span className={`inline-block size-2 rounded-full ${colors[tone]}`} aria-hidden="true" />
}
