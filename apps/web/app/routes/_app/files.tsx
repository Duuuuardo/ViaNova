import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  FolderOpen,
  Trash2,
  Undo2,
} from 'lucide-react'
import { api } from '../../lib/api'
import { Button, Card, ErrorNote } from '../../components/ui'
import { FilePreviewModal, FileThumbnail, fileIcon, type WorkspaceFile } from '../../components/file-preview'
import { createHeadConfig } from '../../lib/seo'

export const Route = createFileRoute('/_app/files')({ head: () => createHeadConfig('Arquivos — Vianova'),
  component: FilesPage,
})

type WorkspaceSummary = {
  subscriptionId: string
  productSlug: string
  workspaceId: string
  workspaceName: string | null
  quotaBytes: number
  maxFileSizeBytes: number
  usedBytes: number
  fileCount: number
  percent: number
}

type WorkspaceDetail = {
  productSlug: string
  workspaceId: string
  quotaBytes: number
  maxFileSizeBytes: number
  usedBytes: number
  fileCount: number
  percent: number
  items: WorkspaceFile[]
  nextCursor: string | null
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log10(bytes) / Math.log10(1024))
  const value = bytes / 1024 ** i
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function FilesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null)
  const [selected, setSelected] = useState<{ productSlug: string; workspaceId: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error: apiError } = await api.files.workspaces.get()
    if (apiError || !data || !('workspaces' in data)) {
      setError('Não foi possível carregar os workspaces.')
      return
    }
    setWorkspaces(data.workspaces as WorkspaceSummary[])
  }

  useEffect(() => {
    load()
  }, [])

  if (error) return <ErrorNote>{error}</ErrorNote>

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">Arquivos</h1>
        <p className="mt-1 text-sm text-ink-500">
          Gerencie mídias e arquivos dos seus workspaces. O upload acontece dentro de cada produto.
        </p>
      </div>

      {selected ? (
        <WorkspaceDetailView
          productSlug={selected.productSlug}
          workspaceId={selected.workspaceId}
          onBack={() => setSelected(null)}
          workspaceName={workspaces?.find((w) => w.workspaceId === selected.workspaceId)?.workspaceName ?? null}
        />
      ) : (
        <WorkspaceList workspaces={workspaces} onSelect={setSelected} />
      )}
    </div>
  )
}

function WorkspaceList({
  workspaces,
  onSelect,
}: {
  workspaces: WorkspaceSummary[] | null
  onSelect: (w: { productSlug: string; workspaceId: string }) => void
}) {
  if (!workspaces) {
    return <p className="text-sm text-ink-500 animate-pulse">Carregando workspaces…</p>
  }

  if (workspaces.length === 0) {
    return (
      <Card className="p-10 text-center space-y-3">
        <FolderOpen size={40} className="mx-auto text-ink-300" aria-hidden="true" />
        <h2 className="font-display text-lg font-bold">Nenhum workspace encontrado</h2>
        <p className="text-sm text-ink-500 max-w-md mx-auto">
          Assine um plano ou entre em um workspace de produto para gerenciar seus arquivos aqui.
        </p>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {workspaces.map((w) => (
        <button
          key={`${w.productSlug}:${w.workspaceId}`}
          onClick={() => onSelect({ productSlug: w.productSlug, workspaceId: w.workspaceId })}
          className="text-left group bg-surface border border-line rounded-card p-5 hover:border-via-500/40 hover:shadow-sm transition-all duration-200"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display font-semibold text-ink-900 truncate">
                {w.workspaceName ?? w.workspaceId}
              </p>
              <p className="text-xs text-ink-500 capitalize">{w.productSlug}</p>
            </div>
            <span className="shrink-0 text-xs font-medium px-2 py-1 rounded-full bg-paper border border-line">
              {w.fileCount} arquivo{w.fileCount === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-500">
                {formatBytes(w.usedBytes)} de {formatBytes(w.quotaBytes)}
              </span>
              <span className={`font-semibold ${w.percent > 85 ? 'text-danger-600' : w.percent > 60 ? 'text-warn-600' : 'text-via-600'}`}>
                {w.percent}%
              </span>
            </div>
            <div className="w-full bg-line/80 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  w.percent > 85 ? 'bg-danger-600' : w.percent > 60 ? 'bg-warn-600' : 'bg-via-500'
                }`}
                style={{ width: `${Math.min(100, w.percent)}%` }}
              />
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

function WorkspaceDetailView({
  productSlug,
  workspaceId,
  workspaceName,
  onBack,
}: {
  productSlug: string
  workspaceId: string
  workspaceName: string | null
  onBack: () => void
}) {
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null)
  const [status, setStatus] = useState<'active' | 'trashed'>('active')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<WorkspaceFile | null>(null)

  async function load() {
    setError(null)
    const { data, error: apiError } = await api.files
      .workspaces({ productSlug })({ workspaceId })
      .get({ query: { status, limit: '50' } })

    if (apiError || !data || !('items' in data)) {
      setError('Não foi possível carregar os arquivos.')
      return
    }
    setDetail(data as WorkspaceDetail)
  }

  useEffect(() => {
    load()
  }, [productSlug, workspaceId, status])

  async function trash(fileId: string) {
    setBusy(fileId)
    const { error: apiError } = await api.files
      .workspaces({ productSlug })({ workspaceId })({ fileId })
      .delete()
    setBusy(null)
    if (apiError) {
      setError('Não foi possível mover o arquivo para a lixeira.')
      return
    }
    setPreviewFile(null)
    await load()
  }

  async function restore(fileId: string) {
    setBusy(fileId)
    const { error: apiError } = await api.files
      .workspaces({ productSlug })({ workspaceId })({ fileId })
      .restore.post()
    setBusy(null)
    if (apiError) {
      setError('Não foi possível restaurar o arquivo.')
      return
    }
    setPreviewFile(null)
    await load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack} className="gap-1.5">
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar
        </Button>
        <div>
          <h2 className="font-display text-xl font-bold text-ink-900">
            {workspaceName ?? workspaceId}
          </h2>
          <p className="text-xs text-ink-500 capitalize">{productSlug}</p>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {detail && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-ink-500">
                {formatBytes(detail.usedBytes)} de {formatBytes(detail.quotaBytes)} usados
              </p>
              <div className="w-56 sm:w-80 bg-line/80 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    detail.percent > 85 ? 'bg-danger-600' : detail.percent > 60 ? 'bg-warn-600' : 'bg-via-500'
                  }`}
                  style={{ width: `${Math.min(100, detail.percent)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStatus('active')}
                className={`px-3 py-1.5 rounded-ctrl text-xs font-semibold transition-colors duration-150 ${
                  status === 'active'
                    ? 'bg-via-600 text-white'
                    : 'bg-paper text-ink-600 hover:bg-line'
                }`}
              >
                Ativos
              </button>
              <button
                onClick={() => setStatus('trashed')}
                className={`px-3 py-1.5 rounded-ctrl text-xs font-semibold transition-colors duration-150 ${
                  status === 'trashed'
                    ? 'bg-via-600 text-white'
                    : 'bg-paper text-ink-600 hover:bg-line'
                }`}
              >
                Lixeira
              </button>
            </div>
          </div>

          {detail.items.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Archive size={32} className="mx-auto text-ink-300" aria-hidden="true" />
              <p className="text-sm text-ink-500">
                {status === 'active' ? 'Nenhum arquivo ativo neste workspace.' : 'Lixeira vazia.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line/60">
              {detail.items.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  status={status}
                  busy={busy === file.id}
                  onPreview={() => setPreviewFile(file)}
                  onDelete={() => trash(file.id)}
                  onRestore={() => restore(file.id)}
                />
              ))}
            </ul>
          )}
        </Card>
      )}

      {!detail && !error && (
        <p className="text-sm text-ink-500 animate-pulse">Carregando arquivos…</p>
      )}

      <FilePreviewModal
        file={previewFile}
        open={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        onDelete={trash}
        onRestore={restore}
        status={status}
      />
    </div>
  )
}

function FileRow({
  file,
  status,
  busy,
  onPreview,
  onDelete,
  onRestore,
}: {
  file: WorkspaceFile
  status: 'active' | 'trashed'
  busy: boolean
  onPreview: () => void
  onDelete: () => void
  onRestore: () => void
}) {
  const Icon = fileIcon(file.mimeType)

  return (
    <li className="group py-3 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors duration-150 hover:bg-paper/60">
      <button
        onClick={onPreview}
        className="shrink-0 transition-transform duration-150 ease-out active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-via-500 focus-visible:ring-offset-2 rounded-ctrl"
        aria-label={`Visualizar ${file.originalName}`}
      >
        <FileThumbnail file={file} className="size-11 shrink-0" />
      </button>
      <button
        onClick={onPreview}
        className="min-w-0 flex-1 text-left transition-colors duration-150 focus:outline-none"
      >
        <p className="text-sm font-medium text-ink-900 group-hover:text-via-600 truncate transition-colors duration-150">
          {file.originalName}
        </p>
        <p className="text-xs text-ink-500">
          {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}
          {file.trashedAt && ` · na lixeira desde ${formatDate(file.trashedAt)}`}
        </p>
      </button>
      <div className="flex items-center gap-2 sm:ml-auto">
        <button
          onClick={onPreview}
          className="shrink-0 text-xs font-medium text-via-600 hover:text-via-700 px-2 py-1 rounded-ctrl hover:bg-via-500/10 transition-colors duration-150"
        >
          Abrir
        </button>
        {status === 'active' ? (
          <IconButton
            busy={busy}
            onClick={onDelete}
            aria-label="Mover para lixeira"
            className="border border-danger-600 text-danger-600 hover:bg-danger-50"
          >
            <Trash2 size={16} aria-hidden="true" />
          </IconButton>
        ) : (
          <IconButton
            busy={busy}
            onClick={onRestore}
            aria-label="Restaurar arquivo"
            className="text-emerald-600 hover:bg-emerald-50"
          >
            <Undo2 size={16} aria-hidden="true" />
          </IconButton>
        )}
      </div>
    </li>
  )
}

function IconButton({
  busy,
  onClick,
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`grid size-8 place-items-center rounded-ctrl transition-all duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${className}`}
      {...props}
    >
      {busy ? (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      ) : (
        children
      )}
    </button>
  )
}
