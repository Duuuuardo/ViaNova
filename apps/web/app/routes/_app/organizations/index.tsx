import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { Button, Card, ErrorNote, Field } from '../../../components/ui'
import { createHeadConfig } from '../../lib/seo'

export const Route = createFileRoute('/_app/organizations/')({ head: () => createHeadConfig('Organizações — Vianova'),
  component: OrganizationsPage,
})

type Organization = {
  id: string
  name: string
  ownerUserId: string
  createdAt: string | Date
}

function OrganizationsPage() {
  const router = useRouter()
  const [organizations, setOrganizations] = useState<Organization[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    const { data } = await api.organizations.get()
    if (data && 'organizations' in data) setOrganizations(data.organizations as Organization[])
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data, error: apiError } = await api.organizations.post({ name })
      if (apiError || !data?.organization) {
        setError('Não foi possível criar a organização.')
        return
      }
      router.navigate({ to: '/organizations/$id', params: { id: data.organization.id } })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Organizações</h1>
          <p className="mt-1 text-sm text-ink-500">
            Agrupe os workspaces da sua empresa nos produtos. A assinatura continua sendo de cada
            workspace.
          </p>
        </div>
        {!creating && organizations && organizations.length > 0 && (
          <Button variant="secondary" onClick={() => setCreating(true)} className="w-full sm:w-auto">
            Criar organização
          </Button>
        )}
      </div>

      {creating && (
        <Card className="p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Nome da organização" htmlFor="org-name">
              <input
                id="org-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Minha Empresa"
                required
                autoFocus
              />
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button type="submit" loading={loading} className="w-full sm:w-auto">
                Criar organização
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {organizations === null ? (
        <p className="text-sm text-ink-500">Carregando…</p>
      ) : organizations.length === 0 && !creating ? (
        <Card className="p-10 text-center">
          <h2 className="font-display text-lg font-bold">Nenhuma organização ainda</h2>
          <p className="mt-1 mb-5 text-sm text-ink-500">
            Crie uma organização para agrupar os workspaces da sua empresa.
          </p>
          <Button onClick={() => setCreating(true)} className="w-full sm:w-auto">Criar organização</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {organizations.map((org) => (
            <Link key={org.id} to="/organizations/$id" params={{ id: org.id }} className="block group">
              <Card className="p-5 flex items-center justify-between transition-colors group-hover:border-via-600">
                <div>
                  <h3 className="font-display font-bold">{org.name}</h3>
                  <p className="text-xs font-mono text-ink-400 mt-0.5">{org.id}</p>
                </div>
                <span className="text-ink-400 group-hover:text-via-600" aria-hidden="true">
                  ›
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
