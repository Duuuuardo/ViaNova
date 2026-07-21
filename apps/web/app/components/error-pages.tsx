import { Link, useMatch, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { House, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { ViaLogo } from './brand'

/*
 * Telas de erro da marca Vianova. O elemento-assinatura deriva da marca (vias
 * que convergem num ponto — a linha de rota): no 404 a rota tracejada termina
 * num destino vazio; no 500 a rota se rompe antes de chegar ao ponto.
 *
 * Duas variantes: a página inteira (rotas sem shell) e a embutida, usada como
 * notFoundComponent/errorComponent de layouts logados — sem logo (a topbar já
 * tem a marca) e sem fundo próprio, para herdar o fundo do conteúdo.
 */

const VIA = '#A63FE8'

function RouteNoDestination() {
  return (
    <svg width="140" height="28" viewBox="0 0 140 28" fill="none" aria-hidden="true">
      <line
        x1="6"
        y1="14"
        x2="104"
        y2="14"
        stroke={VIA}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="1 14"
      />
      <circle cx="126" cy="14" r="6" stroke={VIA} strokeWidth="3" fill="none" opacity="0.45" />
    </svg>
  )
}

function RouteBroken() {
  return (
    <svg width="140" height="28" viewBox="0 0 140 28" fill="none" aria-hidden="true">
      <line x1="6" y1="14" x2="62" y2="14" stroke={VIA} strokeWidth="4" strokeLinecap="round" />
      <line
        x1="84"
        y1="14"
        x2="112"
        y2="14"
        stroke={VIA}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.35"
      />
      <circle cx="128" cy="14" r="5" fill={VIA} opacity="0.35" />
    </svg>
  )
}

function ErrorShell({
  embedded = false,
  signature,
  code,
  title,
  description,
  actions,
  detail,
}: {
  embedded?: boolean
  signature: ReactNode
  code: string
  title: string
  description: string
  actions: ReactNode
  detail?: ReactNode
}) {
  return (
    <main
      className={`err-page flex flex-col items-center justify-center px-6 text-center ${
        embedded ? 'min-h-[60vh] py-12' : 'min-h-dvh bg-paper py-16'
      }`}
    >
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .err-page [data-err-item] {
            opacity: 0;
            transform: translateY(8px);
            animation: err-rise 400ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
          }
          .err-page [data-err-item="1"] { animation-delay: 40ms; }
          .err-page [data-err-item="2"] { animation-delay: 80ms; }
          .err-page [data-err-item="3"] { animation-delay: 120ms; }
          .err-page [data-err-item="4"] { animation-delay: 160ms; }
          @keyframes err-rise {
            to { opacity: 1; transform: translateY(0); }
          }
        }
      `}</style>
      {!embedded && (
        <div className="mb-14" data-err-item="0">
          <ViaLogo size={26} />
        </div>
      )}
      <div data-err-item="1">{signature}</div>
      <p
        className="mt-8 font-mono text-xs font-medium tracking-[0.2em] text-via-700"
        data-err-item="2"
      >
        {code}
      </p>
      <h1
        className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-900"
        data-err-item="2"
      >
        {title}
      </h1>
      <p className="mt-3 max-w-md text-base text-ink-500" data-err-item="3">
        {description}
      </p>
      <div className="mt-8 flex flex-col items-center gap-4" data-err-item="4">
        {actions}
      </div>
      {detail}
    </main>
  )
}

const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-ctrl bg-via-600 px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-via-700 active:scale-[0.97]'
const quietLink =
  'inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 underline-offset-4 transition-colors duration-150 hover:text-ink-900 hover:underline'

function NotFoundContent({ embedded = false }: { embedded?: boolean }) {
  return (
    <ErrorShell
      embedded={embedded}
      signature={<RouteNoDestination />}
      code="ERRO 404"
      title="Página não encontrada"
      description="O endereço que você acessou não existe ou foi movido. Confira o link ou volte para o início."
      actions={
        <Link to="/" className={primaryBtn}>
          <House className="size-4" aria-hidden="true" />
          Voltar ao início
        </Link>
      }
    />
  )
}

function ErrorContent({
  embedded = false,
  error,
  reset,
}: { embedded?: boolean } & ErrorComponentProps) {
  const router = useRouter()

  return (
    <ErrorShell
      embedded={embedded}
      signature={<RouteBroken />}
      code="ERRO 500"
      title="Algo deu errado"
      description="Um problema inesperado impediu esta página de carregar. Tente novamente — se persistir, fale com o suporte."
      actions={
        <>
          <button
            type="button"
            className={primaryBtn}
            onClick={() => {
              reset()
              router.invalidate()
            }}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Tentar novamente
          </button>
          <Link to="/" className={quietLink}>
            ou voltar ao início
          </Link>
        </>
      }
      detail={
        import.meta.env.DEV && error instanceof Error ? (
          <pre className="mt-10 max-w-xl overflow-auto rounded-card border border-line bg-surface p-4 text-left font-mono text-xs text-ink-500">
            {error.message}
          </pre>
        ) : null
      }
    />
  )
}

export function NotFoundPage() {
  return <NotFoundContent />
}

export function NotFoundEmbedded() {
  return <NotFoundContent embedded />
}

export function ErrorPage(props: ErrorComponentProps) {
  // Erros em rotas filhas do shell logado renderizam dentro do Outlet do
  // layout — nesse caso usa a variante embutida para herdar o fundo do
  // conteúdo e não repetir a marca que a topbar já mostra.
  const match = useMatch({ strict: false })
  const insideShell = String(match.routeId).startsWith('/_app/')
  return <ErrorContent embedded={insideShell} {...props} />
}

export function ErrorEmbedded(props: ErrorComponentProps) {
  return <ErrorContent embedded {...props} />
}
