import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { passwordStrength } from '../lib/validation'

export function PasswordInput({
  invalid = false,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { invalid?: boolean }) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        aria-invalid={invalid || undefined}
        className={`pr-10 ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 transition-colors"
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

const barColors = ['bg-danger-600', 'bg-danger-600', 'bg-warn-600', 'bg-ok-600', 'bg-ok-600']
const labelColors = ['text-danger-600', 'text-danger-600', 'text-warn-600', 'text-ok-600', 'text-ok-600']

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null

  const { score, label, checks } = passwordStrength(password)
  const requirements: Array<{ ok: boolean; text: string }> = [
    { ok: checks.minLength, text: 'No mínimo 8 caracteres' },
    { ok: checks.number, text: 'Pelo menos um número' },
    { ok: checks.cases, text: 'Letras maiúsculas e minúsculas' },
    { ok: checks.symbol, text: 'Pelo menos um símbolo (!@#…)' },
  ]

  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                score >= step ? barColors[score] : 'bg-line-strong'
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-semibold ${labelColors[score]}`}>{label}</span>
      </div>
      <ul className="space-y-0.5">
        {requirements.map((req) => (
          <li
            key={req.text}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              req.ok ? 'text-ok-600' : 'text-ink-500'
            }`}
          >
            {req.ok ? <Check size={12} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
            {req.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
