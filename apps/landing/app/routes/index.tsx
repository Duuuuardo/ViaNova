import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowRight,
  CreditCard,
  KeyRound,
  LayoutGrid,
  LogOut,
  Megaphone,
  MessagesSquare,
  ShieldCheck,
  UserRoundPlus,
  Users,
} from 'lucide-react'
import { VianovaLogo, VianovaMark } from '~/components/logo'

export const Route = createFileRoute('/')({
  component: Landing,
})

const ACCOUNT_URL = import.meta.env.VITE_VIANOVA_WEB_URL ?? 'https://vianova.software'
const CAMPAIGNS_URL = 'https://campaigns.naia.website'

function Landing() {
  return (
    <div className="bg-surface">
      <Header />
      <main>
        <Hero />
        <Pains />
        <Products />
        <Steps />
        <Control />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="/" aria-label="Vianova">
          <VianovaLogo size={26} />
        </a>
        <nav className="hidden items-center gap-8 text-sm font-medium text-ink-700 md:flex">
          <a href="#produtos" className="transition-colors hover:text-ink-900">
            Produtos
          </a>
          <a href="#controle" className="transition-colors hover:text-ink-900">
            Controle
          </a>
        </nav>
        <a
          href={`${ACCOUNT_URL}/register`}
          className="rounded-[--radius-ctrl] bg-via-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-via-700"
        >
          Criar conta grátis
        </a>
      </div>
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
            Um login.
            <br />
            <span className="text-via-600">Todos os seus produtos.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-700">
            Sua equipe usa o Naia Campanhas e o CRM com uma conta só.
            Você controla quem tem acesso e vê todas as cobranças num painel.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3">
            <a
              href={`${ACCOUNT_URL}/register`}
              className="inline-flex items-center gap-2 rounded-[--radius-ctrl] bg-via-600 px-6 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-via-700 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              Criar conta grátis
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <p className="text-sm text-ink-500">
              Menos de 1 minuto. Sem cartão de crédito.
            </p>
          </div>
        </div>
        <SwitcherCard />
      </div>
    </section>
  )
}

function SwitcherCard() {
  const [activeProduct, setActiveProduct] = useState<'campaigns' | 'crm'>('campaigns')

  return (
    <div className="relative mx-auto w-full max-w-sm select-none">
      <div className="rounded-[--radius-card] border border-line bg-surface p-6 shadow-xl shadow-via-900/5 transition-all hover:shadow-2xl hover:shadow-via-900/10">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-via-100 text-lg font-bold text-via-700 ring-2 ring-via-500 ring-offset-2 ring-offset-surface">
            AL
          </span>
          <div>
            <p className="font-display text-base font-bold text-ink-900">Ana Lima</p>
            <p className="text-sm text-ink-500">ana@suaempresa.com.br</p>
          </div>
          <span className="ml-auto grid size-9 place-items-center rounded-[--radius-ctrl] border border-line bg-paper text-ink-500 shadow-inner">
            <LayoutGrid size={18} />
          </span>
        </div>

        <div className="mt-5 space-y-2 border-t border-line pt-5">
          <button
            type="button"
            onClick={() => setActiveProduct('campaigns')}
            className={`w-full flex items-center gap-3 rounded-[--radius-ctrl] px-3 py-2.5 text-left transition-all ${
              activeProduct === 'campaigns'
                ? 'bg-via-50 ring-1 ring-via-500/30'
                : 'hover:bg-paper'
            }`}
          >
            <span className={`grid size-8 place-items-center rounded-lg transition-colors ${activeProduct === 'campaigns' ? 'bg-via-600 text-white shadow-sm' : 'bg-via-100 text-via-700'}`}>
              <Megaphone size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-900">Naia Campanhas</p>
              <p className="text-xs text-ink-500 truncate">Disparos no WhatsApp e Telegram</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveProduct('crm')}
            className={`w-full flex items-center gap-3 rounded-[--radius-ctrl] px-3 py-2.5 text-left transition-all ${
              activeProduct === 'crm'
                ? 'bg-via-50 ring-1 ring-via-500/30'
                : 'hover:bg-paper'
            }`}
          >
            <span className={`grid size-8 place-items-center rounded-lg transition-colors ${activeProduct === 'crm' ? 'bg-ink-900 text-white shadow-sm' : 'bg-ink-100 text-ink-700'}`}>
              <MessagesSquare size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-900">Naia CRM</p>
              <p className="text-xs text-ink-500 truncate">Atendimento multicanal</p>
            </div>
          </button>
        </div>

        <div className="mt-4 rounded-[--radius-ctrl] bg-paper px-3 py-2 text-center">
          <p className="text-xs font-medium text-ink-700">
            Sessão ativa em todos os produtos
          </p>
        </div>
      </div>
    </div>
  )
}

const pains = [
  {
    icon: KeyRound,
    text: 'Mais um login pra equipe esquecer, mais um pro suporte resetar.',
  },
  {
    icon: CreditCard,
    text: 'Mais uma fatura solta pra conciliar no fim do mês.',
  },
  {
    icon: LogOut,
    text: 'Mais um acesso pra caçar e revogar quando alguém sai do time.',
  },
]

function Pains() {
  return (
    <section className="border-y border-line bg-paper">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <h2 className="max-w-2xl font-display text-2xl font-bold tracking-tight text-ink-900 md:text-3xl">
          Cada ferramenta nova que a sua equipe adota deixa rastro.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {pains.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-start gap-4 rounded-[--radius-card] border border-line bg-surface p-5"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-[--radius-ctrl] bg-via-50 text-via-700">
                <Icon size={20} />
              </span>
              <p className="text-sm leading-relaxed text-ink-700">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-2xl text-lg text-ink-700">
          Com a Vianova, <strong className="text-ink-900">uma conta resolve login, equipe e cobrança</strong> de todos os produtos que vocês usam.
        </p>
      </div>
    </section>
  )
}

function Products() {
  return (
    <section id="produtos" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16 md:py-24">
      <p className="text-sm font-semibold uppercase tracking-widest text-via-600">
        Produtos
      </p>
      <h2 className="mt-2 max-w-2xl font-display text-2xl font-bold tracking-tight text-ink-900 md:text-4xl">
        Comunicação que vende, dos dois lados da conversa.
      </h2>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <article className="group flex flex-col rounded-[--radius-card] border border-line bg-surface p-8 transition-shadow hover:shadow-lg">
          <span className="grid size-12 place-items-center rounded-[--radius-ctrl] bg-via-600 text-white">
            <Megaphone size={24} />
          </span>
          <h3 className="mt-5 font-display text-xl font-bold text-ink-900">
            Naia Campanhas
          </h3>
          <p className="mt-2 flex-1 leading-relaxed text-ink-700">
            Dispare campanhas de WhatsApp e Telegram para milhares de contatos
            de uma vez. Opt-in respeitado, resultado de cada mensagem na tela.
          </p>
          <a
            href={CAMPAIGNS_URL}
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-via-600 transition-colors hover:text-via-700"
          >
            Conhecer o Naia Campanhas
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0" />
          </a>
        </article>
        <article className="flex flex-col rounded-[--radius-card] border border-line bg-surface p-8">
          <span className="grid size-12 place-items-center rounded-[--radius-ctrl] bg-ink-900 text-white">
            <MessagesSquare size={24} />
          </span>
          <div className="mt-5 flex items-center gap-3">
            <h3 className="font-display text-xl font-bold text-ink-900">Naia CRM</h3>
            <span className="rounded-full bg-via-100 px-2.5 py-0.5 text-xs font-semibold text-via-700">
              Em breve
            </span>
          </div>
          <p className="mt-2 flex-1 leading-relaxed text-ink-700">
            Todas as conversas de WhatsApp e Telegram num inbox só, com
            atribuição por atendente. Sua equipe responde cada cliente sem
            disputar o mesmo celular.
          </p>
          <p className="mt-6 text-sm font-medium text-ink-500">
            Chega ainda este ano para contas Vianova.
          </p>
        </article>
      </div>
    </section>
  )
}

const steps = [
  {
    icon: UserRoundPlus,
    title: 'Crie sua conta',
    text: 'Nome, email e senha. Em menos de 1 minuto sua conta Vianova existe.',
  },
  {
    icon: LayoutGrid,
    title: 'Ative um produto',
    text: 'Cada produto tem plano próprio. Assine só o que a sua operação usa.',
  },
  {
    icon: Users,
    title: 'Convide a equipe',
    text: 'Todo mundo entra com a mesma conta, sem planilha de senhas circulando.',
  },
]

function Steps() {
  return (
    <section className="border-y border-line bg-paper">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <h2 className="max-w-2xl font-display text-2xl font-bold tracking-tight text-ink-900 md:text-4xl">
          Três passos para começar.
        </h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-via-600 text-white">
                  <Icon size={20} />
                </span>
                <span className="font-mono text-sm text-via-600">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-ink-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const controls = [
  {
    icon: ShieldCheck,
    title: 'Verificação em duas etapas',
    text: 'Proteja a conta de cada pessoa da equipe com um segundo fator, direto no app de autenticação que ela já usa.',
  },
  {
    icon: LogOut,
    title: 'Saiu da empresa, saiu de tudo',
    text: 'Desativou alguém na Vianova? A sessão cai em todos os produtos na mesma hora, não no fim do dia.',
  },
  {
    icon: CreditCard,
    title: 'Cobrança sem caça ao tesouro',
    text: 'Todas as assinaturas da empresa, de todos os produtos, num painel só: plano, uso e fatura de cada workspace.',
  },
  {
    icon: Users,
    title: 'Um perfil, todos os produtos',
    text: 'Nome, foto e preferências definidos uma vez. A equipe aparece igual em qualquer produto.',
  },
]

function Control() {
  return (
    <section id="controle" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16 md:py-24">
      <p className="text-sm font-semibold uppercase tracking-widest text-via-600">
        Controle
      </p>
      <h2 className="mt-2 max-w-2xl font-display text-2xl font-bold tracking-tight text-ink-900 md:text-4xl">
        Quem entra, quem sai, quem paga: tudo à vista.
      </h2>
      <div className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
        {controls.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-[--radius-ctrl] bg-via-50 text-via-700">
              <Icon size={22} />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{text}</p>
            </div>
          </div>
        ))}
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
          Crie sua conta e ative o Naia Campanhas hoje.
        </h2>
        <p className="mt-4 max-w-md text-base leading-relaxed text-ink-400">
          A conta é gratuita. Os produtos têm plano próprio — você assina quando
          a equipe estiver pronta.
        </p>
        <a
          href={`${ACCOUNT_URL}/register`}
          className="mt-8 inline-flex items-center gap-2 rounded-[--radius-ctrl] bg-via-500 px-7 py-3.5 text-base font-semibold text-ink-950 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-via-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          Criar conta grátis
          <ArrowRight size={18} aria-hidden="true" />
        </a>
        <p className="mt-3 text-sm text-ink-500">
          Menos de 1 minuto. Sem cartão de crédito.
        </p>
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
              Uma conta para toda a operação da sua equipe.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-16 gap-y-2 text-sm" aria-label="Rodapé">
            <p className="col-span-2 mb-1 font-semibold text-ink-900">Produtos</p>
            <a href={CAMPAIGNS_URL} className="text-ink-700 transition-colors hover:text-via-600">
              Naia Campanhas
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
