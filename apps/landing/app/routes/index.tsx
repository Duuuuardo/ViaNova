import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Check,
  CreditCard,
  Layers,
  LayoutGrid,
  Link,
  LogOut,
  Megaphone,
  Menu,
  MessagesSquare,
  ShieldCheck,
  TrendingUp,
  UserRoundPlus,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { VianovaLogo, VianovaMark } from '~/components/logo'
import { requireEnv } from '../lib/env'

export const Route = createFileRoute('/')({
  component: Landing,
})

const ACCOUNT_URL = requireEnv('VITE_VIANOVA_WEB_URL')
const CAMPAIGNS_URL = 'https://campaigns.naia.website'

function Landing() {
  return (
    <div className="bg-surface">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Beliefs />
        <Products />
        <Account />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!mobileOpen) return
    document.body.style.overflow = 'hidden'
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onEscape)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onEscape)
    }
  }, [mobileOpen])

  const navLinks = [
    { href: '#produtos', label: 'Produtos' },
    { href: '#conta', label: 'Conta' },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <a href="/" aria-label="Vianova">
          <VianovaLogo size={26} />
        </a>
        <nav className="hidden items-center gap-8 text-sm font-medium text-ink-700 md:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-ink-900">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={`${ACCOUNT_URL}/register`}
            className="rounded-[--radius-ctrl] bg-via-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-via-700 md:px-4"
          >
            Criar conta
          </a>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
            aria-haspopup="dialog"
            className="inline-flex size-9 items-center justify-center rounded-[--radius-ctrl] text-ink-500 hover:bg-paper hover:text-ink-900 transition-colors md:hidden"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
          className="fixed inset-0 z-50 md:hidden"
        >
          <div
            className="absolute inset-0 bg-ink-900/30 backdrop-blur-xs motion-safe:animate-[fade-in_200ms_ease-out]"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-0 bottom-0 w-64 max-w-[80vw] bg-surface border-l border-line shadow-xl motion-safe:animate-[drawer-in_200ms_ease-out] flex flex-col">
            <div className="flex items-center justify-between px-4 h-16 border-b border-line">
              <span className="font-display text-sm font-bold text-ink-900">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar menu"
                className="inline-flex size-8 items-center justify-center rounded-[--radius-ctrl] text-ink-500 hover:bg-paper hover:text-ink-900 transition-colors"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-[--radius-ctrl] px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-paper hover:text-ink-900 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="p-4 border-t border-line">
              <a
                href={`${ACCOUNT_URL}/register`}
                className="block w-full rounded-[--radius-ctrl] bg-via-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-via-700"
              >
                Criar conta
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-via-100 opacity-60 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 md:grid-cols-2 md:py-28">
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-ink-900 md:text-6xl">
            Construímos ferramentas para equipes que crescem.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-700">
            Nossos produtos compartilham uma base comum: uma conta por pessoa,
            acesso definido por produto e billing num painel só. Equipes em crescimento
            não precisam reconfigurar acesso e cobrança toda vez que adotam uma ferramenta nova.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3">
            <a
              href={`${ACCOUNT_URL}/register`}
              className="inline-flex items-center gap-2 rounded-[--radius-ctrl] bg-via-600 px-6 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-via-700 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              Criar conta grátis
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <p className="text-sm text-ink-500">Menos de 1 minuto. Sem cartão de crédito.</p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-medium text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-emerald-600" /> Uma conta para todos os produtos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-emerald-600" /> SSO e 2FA incluídos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-emerald-600" /> Billing centralizado
              </span>
            </div>
          </div>
        </div>
        <PortfolioCard />
      </div>
    </section>
  )
}

function PortfolioCard() {
  return (
    <div className="relative mx-auto w-full max-w-sm select-none">
      <div className="rounded-[--radius-card] border border-line bg-surface p-6 shadow-xl shadow-via-900/5 transition-all hover:shadow-2xl hover:shadow-via-900/10">
        <div className="flex items-center gap-3 border-b border-line pb-5">
          <VianovaMark size={22} />
          <p className="text-sm font-semibold text-ink-900">Produtos Vianova</p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-4 rounded-[--radius-ctrl] bg-via-50 p-4 ring-1 ring-via-200">
            <span className="grid size-10 shrink-0 place-items-center rounded-[--radius-ctrl] bg-via-600 text-white shadow-sm">
              <Megaphone size={18} />
            </span>
            <div>
              <p className="text-sm font-bold text-ink-900">Naia Campaigns</p>
              <p className="text-xs text-ink-500">Campanhas em massa por WhatsApp e Telegram</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-[--radius-ctrl] bg-paper p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-[--radius-ctrl] bg-ink-900 text-white shadow-sm">
              <MessagesSquare size={18} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-ink-900">Naia CRM</p>
                <span className="rounded-full bg-via-100 px-2 py-0.5 text-xs font-semibold text-via-700">
                  Em breve
                </span>
              </div>
              <p className="text-xs text-ink-500">Inbox unificado para atendimento multicanal</p>
            </div>
          </div>
        </div>

        <p className="mt-5 border-t border-line pt-4 text-center text-xs text-ink-400">
          Todos os produtos compartilham a mesma conta Vianova
        </p>
      </div>
    </div>
  )
}

const steps = [
  {
    icon: UserRoundPlus,
    title: 'Crie uma conta',
    text: 'Um cadastro rápido serve para todos os produtos. Convide a equipe e defina permissões por produto.',
  },
  {
    icon: Layers,
    title: 'Ative os produtos',
    text: 'Assine apenas o que usar. Cada produto tem seu próprio plano, billing e limites.',
  },
  {
    icon: ShieldCheck,
    title: 'Gerencie tudo num lugar',
    text: 'Login, 2FA, sessões ativas e faturas ficam centralizados na conta Vianova.',
  },
]

function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-sm font-semibold uppercase tracking-widest text-via-600">Como funciona</p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink-900 md:text-3xl">
          Uma conta, vários produtos, zero retrabalho
        </h2>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {steps.map(({ icon: Icon, title, text }, index) => (
          <div key={title} className="relative rounded-[--radius-card] border border-line bg-surface p-6">
            <span className="absolute -top-3 left-6 inline-flex size-6 items-center justify-center rounded-full bg-via-100 text-[11px] font-bold text-via-700">
              {index + 1}
            </span>
            <span className="grid size-11 place-items-center rounded-[--radius-ctrl] bg-via-50 text-via-700 mt-2">
              <Icon size={22} />
            </span>
            <h3 className="mt-4 font-display text-base font-bold text-ink-900">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">{text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const beliefs = [
  {
    icon: Link,
    title: 'Ferramentas conectadas custam menos no longo prazo',
    text: 'Um time que usa ferramentas com identidade, acesso e billing compartilhados economiza na entrada e na saída de cada funcionário, e na hora de ler o que a empresa paga. Ferramentas isoladas custam caro mesmo com preço baixo.',
  },
  {
    icon: TrendingUp,
    title: 'Infraestrutura ruim é a que trava o crescimento',
    text: 'Quando a equipe cresce e adota um produto novo, ninguém reconfigura acesso do zero. A base acompanha a equipe e não precisa ser refeita a cada expansão.',
  },
  {
    icon: Zap,
    title: 'Software bom some da frente da equipe',
    text: 'Gerenciar login, revogar acesso e conciliar fatura ocupam tempo que sua equipe poderia usar no trabalho. Nossa infraestrutura cuida disso para você.',
  },
]

function Beliefs() {
  return (
    <section className="border-y border-line bg-paper">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="flex items-center gap-2.5">
          <span className="block h-px w-5 rounded-full bg-via-500" aria-hidden="true" />
          <p className="text-sm font-semibold uppercase tracking-widest text-via-600">O que acreditamos</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {beliefs.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex flex-col gap-4 rounded-[--radius-card] border border-line bg-surface p-6 transition-shadow hover:shadow-md">
              <span className="grid size-10 place-items-center rounded-[--radius-ctrl] bg-via-50 text-via-700">
                <Icon size={20} />
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-700">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Products() {
  return (
    <section id="produtos" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16 md:py-24">
      <div className="flex items-center gap-2.5">
        <span className="block h-px w-5 rounded-full bg-via-500" aria-hidden="true" />
        <p className="text-sm font-semibold uppercase tracking-widest text-via-600">O que construímos</p>
      </div>
      <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink-900 md:text-4xl">
        Nossos produtos.
      </h2>
      <p className="mt-4 max-w-xl text-lg text-ink-700">
        Temos dois produtos hoje. Cada um roda sobre a conta Vianova, com a mesma equipe e o mesmo painel de billing.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <article className="group flex items-center gap-5 rounded-[--radius-card] border border-line bg-surface p-6 transition-shadow hover:shadow-md">
          <span className="grid size-12 shrink-0 place-items-center rounded-[--radius-ctrl] bg-via-600 text-white">
            <Megaphone size={22} />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base font-bold text-ink-900">Naia Campaigns</h3>
            <p className="mt-0.5 text-sm text-ink-500">Campanhas em massa por WhatsApp e Telegram</p>
          </div>
          <a
            href={CAMPAIGNS_URL}
            aria-label="Conhecer o Naia Campaigns"
            className="shrink-0 text-via-500 transition-colors hover:text-via-700"
          >
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0" />
          </a>
        </article>

        <article className="flex items-center gap-5 rounded-[--radius-card] border border-line bg-surface p-6">
          <span className="grid size-12 shrink-0 place-items-center rounded-[--radius-ctrl] bg-ink-900 text-white">
            <MessagesSquare size={22} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-bold text-ink-900">Naia CRM</h3>
              <span className="rounded-full bg-via-100 px-2.5 py-0.5 text-xs font-semibold text-via-700">
                Em breve
              </span>
            </div>
            <p className="mt-0.5 text-sm text-ink-500">Inbox unificado para atendimento multicanal</p>
          </div>
        </article>
      </div>
    </section>
  )
}

const accountFeatures = [
  {
    icon: UserRoundPlus,
    title: 'Uma conta por pessoa',
    text: 'Cada membro da equipe tem um login Vianova. Uma identidade para todos os produtos.',
  },
  {
    icon: LayoutGrid,
    title: 'Acesso definido por produto',
    text: 'Você decide quem acessa o quê. Cada produto tem sua permissão. Cada pessoa vê só o que tem autorização para ver.',
  },
  {
    icon: ShieldCheck,
    title: '2FA em toda a equipe',
    text: 'Segundo fator no app de autenticação que cada pessoa já usa. Você ativa por conta.',
  },
  {
    icon: LogOut,
    title: 'Saiu do time, saiu de tudo',
    text: 'Desativou alguém? A sessão cai em todos os produtos na hora.',
  },
  {
    icon: CreditCard,
    title: 'Billing num painel só',
    text: 'Plano, uso e histórico de cada produto num painel. Sem fatura solta para conciliar.',
  },
  {
    icon: Layers,
    title: 'Base comum, produtos independentes',
    text: 'Cada produto tem plano próprio, billing próprio e roadmap próprio. A conta e a equipe são as mesmas em todos.',
  },
]

function Account() {
  return (
    <section id="conta" className="border-y border-line bg-paper">
      <div className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16 md:py-24">
        <div className="flex items-center gap-2.5">
          <span className="block h-px w-5 rounded-full bg-via-500" aria-hidden="true" />
          <p className="text-sm font-semibold uppercase tracking-widest text-via-600">A conta Vianova</p>
        </div>
        <h2 className="mt-2 max-w-2xl font-display text-2xl font-bold tracking-tight text-ink-900 md:text-4xl">
          A camada que conecta todos os produtos.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-ink-700">
          Cada produto Vianova roda sobre uma conta compartilhada. Você configura
          a equipe uma vez. As permissões e o billing valem em todos os produtos.
        </p>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accountFeatures.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex flex-col gap-3 rounded-[--radius-card] border border-line bg-surface p-5 transition-shadow hover:shadow-sm">
              <span className="grid size-10 place-items-center rounded-[--radius-ctrl] bg-via-50 text-via-700">
                <Icon size={20} />
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-700">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="border-t border-line bg-ink-900">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-20 text-center md:py-24">
        <VianovaMark size={40} />
        <h2 className="mt-6 max-w-xl font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">
          Crie a conta. Ative o que sua operação precisa.
        </h2>
        <p className="mt-4 max-w-md text-base leading-relaxed text-ink-400">
          A conta é gratuita. Você só paga pelos produtos que ativar, quando sua equipe precisar.
        </p>
        <a
          href={`${ACCOUNT_URL}/register`}
          className="mt-8 inline-flex items-center gap-2 rounded-[--radius-ctrl] bg-via-500 px-7 py-3.5 text-base font-semibold text-ink-950 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-via-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          Criar conta grátis
          <ArrowRight size={18} aria-hidden="true" />
        </a>
        <p className="mt-3 text-sm text-ink-500">Menos de 1 minuto. Sem cartão de crédito.</p>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
          <div>
            <VianovaLogo size={24} />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-500">
              Ferramentas para equipes que crescem.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-16 gap-y-2 text-sm" aria-label="Rodapé">
            <p className="col-span-2 mb-1 font-semibold text-ink-900">Produtos</p>
            <a
              href={CAMPAIGNS_URL}
              className="text-ink-700 transition-colors hover:text-via-600"
            >
              Naia Campaigns
            </a>
            <span className="text-ink-400">Naia CRM (em breve)</span>
          </nav>
        </div>
        <p className="mt-10 border-t border-line pt-6 text-xs text-ink-400">
          © {new Date().getFullYear()} Vianova. Feito no Brasil.
        </p>
      </div>
    </footer>
  )
}
