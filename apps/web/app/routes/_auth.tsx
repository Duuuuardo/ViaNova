import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ViaLogo } from '../components/brand'

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
})

const PANEL_FEATURES = [
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Uma conta, todos os produtos',
    desc: 'Entre uma vez. CRM, Campaigns e o que vier a seguir, tudo acessível pelo mesmo login.',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: 'Autenticação robusta',
    desc: 'Suporte a 2FA, sessões auditáveis e tokens de curta duração para toda a suite.',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: 'Permissões calibradas',
    desc: 'Cada membro tem o nível de acesso certo em cada produto.',
  },
]

function BrandPanel() {
  return (
    <div className="hidden lg:flex relative flex-col bg-ink-950 px-14 py-12 overflow-hidden">
      {}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-via-600 opacity-[0.14] blur-3xl" />
        <div className="absolute bottom-[-8%] right-[-12%] h-96 w-96 rounded-full bg-via-500 opacity-[0.09] blur-3xl" />
        {}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(196,102,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(196,102,255,1) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }}
        />
      </div>

      {}
      <div className="relative">
        <ViaLogo size={28} dark />
      </div>

      {}
      <div className="relative flex-1 flex flex-col justify-center max-w-xs">
        <h1 className="text-[2.1rem] font-display font-bold leading-[1.18] tracking-tight text-white">
          Uma conta.<br />
          <span className="text-via-400">Todos os produtos.</span>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-500">
          O Vianova é o centro de identidade da sua empresa. Entre uma vez e acesse cada produto com as permissões certas.
        </p>

        <div className="mt-10 space-y-6">
          {PANEL_FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-3.5">
              <div className="mt-0.5 shrink-0 grid size-8 place-items-center rounded-lg bg-via-600/15 border border-via-600/20 text-via-400">
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{f.title}</p>
                <p className="mt-0.5 text-sm text-ink-500 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>


    </div>
  )
}

function AuthLayout() {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1fr_480px]">
      <BrandPanel />

      {}
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 bg-paper lg:min-h-0">
        {}
        <div className="mb-8 lg:hidden">
          <ViaLogo size={26} />
        </div>

        <div className="w-full max-w-sm">
          <div className="bg-surface border border-line rounded-card p-8 shadow-[0_1px_2px_rgba(22,21,31,0.05)]">
            <Outlet />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-ink-400">
          Uma conta para todos os produtos.
        </p>
      </main>
    </div>
  )
}
