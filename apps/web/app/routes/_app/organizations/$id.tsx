import { createFileRoute, Link, useRouter, getRouteApi } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { Button, Card, ErrorNote, Field, SectionTitle } from '../../../components/ui'

export const Route = createFileRoute('/_app/organizations/$id')({
  component: OrganizationDetailPage,
})

const appRoute = getRouteApi('/_app')

type OrgDetail = {
  organization: { id: string; name: string; ownerUserId: string }
  members: {
    id: string
    userId: string
    name: string
    email: string
    avatarUrl: string | null
  }[]
}

function OrganizationDetailPage() {
  const router = useRouter()
  const { id } = Route.useParams()
  const { user } = appRoute.useRouteContext()
  const [detail, setDetail] = useState<OrgDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    const { data, error: apiError } = await api.organizations({ id }).get()
    if (apiError || !data || !('organization' in data)) {
      setNotFound(true)
      return
    }
    setDetail(data as OrgDetail)
  }

  useEffect(() => {
    load()
  }, [id])

  if (notFound) {
    return (
      <div>
        <p className="text-sm text-ink-500">
          Organização não encontrada ou você não tem acesso.{' '}
          <Link to="/organizations" className="text-via-600 font-medium">
            Voltar ›
          </Link>
        </p>
      </div>
    )
  }

  if (!detail) return <p className="text-sm text-ink-500">Carregando…</p>

  const isOwner = detail.organization.ownerUserId === user.id

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error: apiError } = await api
        .organizations({ id })
        .members.post({ email: inviteEmail })
      if (apiError) {
        setError(
          (apiError.value as { message?: string })?.message ?? 'Não foi possível adicionar.',
        )
        return
      }
      setInviteEmail('')
      load()
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    await api.organizations({ id }).members({ userId }).delete()
    load()
  }

  async function handleDelete() {
    if (!confirm(`Excluir a organização "${detail!.organization.name}"?`)) return
    await api.organizations({ id }).delete()
    router.navigate({ to: '/organizations' })
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link to="/organizations" className="text-xs font-medium text-ink-500 hover:text-ink-900">
          ‹ Organizações
        </Link>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
          {detail.organization.name}
        </h1>
      </div>

      <section className="space-y-3">
        <SectionTitle>Membros</SectionTitle>
        <Card className="divide-y divide-line">
          {detail.members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-via-50 font-display font-bold text-via-700 uppercase">
                  {member.name[0]}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {member.name}
                    {member.userId === detail.organization.ownerUserId && (
                      <span className="ml-2 text-xs font-medium text-ink-500 bg-paper border border-line px-1.5 py-0.5 rounded-full">
                        Dono
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-500 font-mono">{member.email}</p>
                </div>
              </div>
              {isOwner && member.userId !== detail.organization.ownerUserId && (
                <button
                  onClick={() => handleRemoveMember(member.userId)}
                  className="text-xs font-medium text-danger-600 hover:underline"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
        </Card>

        {isOwner && (
          <Card className="p-4">
            <form onSubmit={handleAddMember} className="flex items-end gap-3">
              <div className="flex-1">
                <Field
                  label="Adicionar membro"
                  htmlFor="invite-email"
                  hint="A pessoa precisa já ter conta Vianova."
                >
                  <input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="pessoa@empresa.com"
                    required
                  />
                </Field>
              </div>
              <Button type="submit" variant="secondary" loading={loading} className="mb-6">
                Adicionar
              </Button>
            </form>
            {error && <ErrorNote>{error}</ErrorNote>}
          </Card>
        )}
      </section>

      {isOwner && (
        <section className="space-y-3">
          <SectionTitle>Zona de risco</SectionTitle>
          <Card className="p-4 flex items-center justify-between">
            <p className="text-sm text-ink-500">
              Excluir a organização não afeta os workspaces dos produtos — apenas o agrupamento.
            </p>
            <Button variant="danger" onClick={handleDelete}>
              Excluir organização
            </Button>
          </Card>
        </section>
      )}
    </div>
  )
}
