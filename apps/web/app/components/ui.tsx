import { type ButtonHTMLAttributes, type ReactNode, useState, useEffect } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-via-600 text-white hover:bg-via-700',
  secondary: 'border border-line-strong bg-surface text-ink-900 hover:bg-paper',
  ghost: 'text-ink-700 hover:bg-paper',
  danger: 'bg-[#d64545] text-white hover:bg-[#b83838]',
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
  error,
}: {
  label: string
  htmlFor: string
  children: ReactNode
  hint?: string
  error?: string | null
}) {
  return (
    <div>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-danger-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>
      )}
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


export type SwitchSize = 'sm' | 'md'

export function Switch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className = '',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: SwitchSize
}) {
  const [internalChecked, setInternalChecked] = useState(checked)

  useEffect(() => {
    setInternalChecked(checked)
  }, [checked])

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    if (disabled) return
    const next = !internalChecked
    setInternalChecked(next)
    onChange(next)
  }

  const isSm = size === 'sm'
  const trackSize = isSm ? 'h-5 w-9' : 'h-6 w-11'
  const thumbBase = isSm ? 'h-4' : 'h-5'
  const thumbWidth = isSm
    ? 'w-4 group-active:w-6'
    : 'w-5 group-active:w-7'
  const thumbTranslate = isSm
    ? internalChecked
      ? 'translate-x-[18px] group-active:translate-x-[10px]'
      : 'translate-x-[2px] group-active:translate-x-[2px]'
    : internalChecked
      ? 'translate-x-[22px] group-active:translate-x-[14px]'
      : 'translate-x-[2px] group-active:translate-x-[2px]'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={internalChecked}
      disabled={disabled}
      {...props}
      onClick={(e) => {
        handleToggle(e)
        props.onClick?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          handleToggle(e)
        }
        props.onKeyDown?.(e)
      }}
      className={`group relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-via-500 focus-visible:ring-offset-2 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${trackSize} ${
        internalChecked
          ? 'bg-via-600 shadow-inner-sm'
          : 'bg-line-strong hover:bg-ink-400/80 border border-ink-200/60'
      } ${className}`}
    >
      <span
        className={`pointer-events-none inline-block rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.06] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${thumbBase} ${thumbWidth} ${thumbTranslate}`}
        aria-hidden="true"
      />
    </button>
  )
}

export function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled = false,
  size = 'md',
}: {
  id: string
  label: ReactNode
  hint?: ReactNode
  checked: boolean
  onChange: (on: boolean) => void
  disabled?: boolean
  size?: SwitchSize
}) {
  const [internalChecked, setInternalChecked] = useState(checked)

  useEffect(() => {
    setInternalChecked(checked)
  }, [checked])

  const handleRowClick = () => {
    if (disabled) return
    const next = !internalChecked
    setInternalChecked(next)
    onChange(next)
  }

  return (
    <div
      onClick={handleRowClick}
      className={`group/row flex items-center justify-between gap-4 select-none ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <span className="min-w-0 flex-1">
        <label
          htmlFor={id}
          onClick={(e) => e.preventDefault()}
          className={`mb-0 flex items-center gap-1.5 text-sm font-semibold text-ink-900 transition-colors duration-150 ${
            disabled ? 'cursor-not-allowed' : 'cursor-pointer group-hover/row:text-via-700'
          }`}
        >
          {label}
        </label>
        {hint && (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
            {hint}
          </span>
        )}
      </span>
      <Switch
        id={id}
        checked={internalChecked}
        onChange={(val) => {
          setInternalChecked(val)
          onChange(val)
        }}
        disabled={disabled}
        size={size}
        aria-label={typeof label === 'string' ? label : undefined}
      />
    </div>
  )
}
