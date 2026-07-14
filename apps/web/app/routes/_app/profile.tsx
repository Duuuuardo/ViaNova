import { createFileRoute, Link, useRouter, getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../../lib/api'
import { Button, Card, ErrorNote, Field, SectionTitle, StatusDot } from '../../components/ui'

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
})

const appRoute = getRouteApi('/_app')

function ProfilePage() {
  const router = useRouter()
  const { user } = appRoute.useRouteContext()
  const [name, setName] = useState(user.name)
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '')
  const [phone, setPhone] = useState(user.phone ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setLoading(true)
    try {
      const { error: apiError } = await api.auth.profile.patch({ name, avatarUrl, phone })
      if (apiError) {
        setError('Não foi possível salvar. Tente novamente.')
        return
      }
      setSaved(true)
      router.invalidate()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Perfil</h1>
        <p className="mt-1 text-sm text-ink-500">Como você aparece nos produtos do ecossistema.</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="size-14 rounded-full object-cover border border-line"
              />
            ) : (
              <span className="flex size-14 items-center justify-center rounded-full bg-via-50 font-display text-xl font-bold text-via-700 uppercase">
                {name[0] ?? '?'}
              </span>
            )}
            <div className="flex-1">
              <Field label="URL da foto" htmlFor="avatarUrl">
                <input
                  id="avatarUrl"
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://…"
                />
              </Field>
            </div>
          </div>

          <Field label="Nome" htmlFor="name">
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <Field label="Telefone" htmlFor="phone">
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 11 99999-0000"
            />
          </Field>

          {error && <ErrorNote>{error}</ErrorNote>}
          {saved && <p className="text-sm text-ok-600">Perfil salvo.</p>}

          <Button type="submit" loading={loading}>
            Salvar alterações
          </Button>
        </form>
      </Card>

      <section className="space-y-3">
        <SectionTitle>Métodos de autenticação</SectionTitle>
        <Card className="divide-y divide-line">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">Email e senha</p>
              <p className="text-xs text-ink-500 font-mono">{user.email}</p>
            </div>
            <span className="flex items-center gap-2 text-xs text-ink-500">
              <StatusDot tone="ok" /> Ativo
            </span>
          </div>
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">Verificação em duas etapas</p>
              <p className="text-xs text-ink-500">
                Código por app autenticador ao entrar.
              </p>
            </div>
            {user.twoFactorEnabled ? (
              <span className="flex items-center gap-2 text-xs text-ink-500">
                <StatusDot tone="ok" /> Ativa
              </span>
            ) : (
              <Link
                to="/security"
                className="text-sm font-medium text-via-600 hover:text-via-700"
              >
                Ativar ›
              </Link>
            )}
          </div>
        </Card>
      </section>
    </div>
  )
}
