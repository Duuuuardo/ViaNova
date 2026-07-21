import { createFileRoute, Link } from '@tanstack/react-router'
import { ViaLogo } from '../components/brand'
import { createHeadConfig } from '../lib/seo'

export const Route = createFileRoute('/terms')({
  head: () => createHeadConfig('Termos de Uso — Vianova'),
  component: TermosPage,
})

function TermosPage() {
  return (
    <div className="min-h-screen bg-paper font-sans">
      <header className="border-b border-line bg-paper sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/login" search={{ redirect_uri: undefined }}>
            <ViaLogo size={22} />
          </Link>
          <Link to="/login" search={{ redirect_uri: undefined }} className="text-sm text-ink-500 hover:text-ink-900 transition-colors">
            Entrar
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14 pb-24">
        <div className="mb-10">
          <p className="text-xs font-medium text-via-600 uppercase tracking-wider mb-3">Documentos legais</p>
          <h1 className="text-3xl font-display font-bold text-ink-900 tracking-tight">Termos de Uso</h1>
          <p className="mt-2 text-sm text-ink-400">Última atualização: 20 de julho de 2026</p>
        </div>

        <div className="prose-legal">
          <p>
            Estes Termos regem o acesso a todos os produtos da <strong>Vianova Software Ltda.</strong> ("Vianova"): Naia Campaigns, Naia CRM e qualquer produto futuro acessível pela conta Vianova.
          </p>
          <p>
            Usar qualquer produto da plataforma implica aceitação integral destes Termos. Quem representa uma empresa declara ter autoridade para aceitar em nome dela.
          </p>

          <h2>1. Elegibilidade</h2>
          <p>
            Você precisa ter ao menos 18 anos e capacidade legal para contratar. Ao criar a conta, você se compromete a fornecer informações verdadeiras e atualizadas. Guardar as credenciais em sigilo é responsabilidade sua. Acessos causados por senha comprometida não geram responsabilidade para a Vianova.
          </p>
          <p>
            Cada pessoa física pode ter uma conta Vianova. A Vianova encerra, sem aviso, contas criadas para fraudar, contornar suspensões ou simular organizações fictícias.
          </p>

          <h2>2. Planos e pagamentos</h2>
          <p>
            Planos pagos são cobrados mensalmente ou anualmente via Stripe, em reais (BRL), já com tributos incluídos. Upgrades têm efeito imediato; o proporcional do período restante é descontado na próxima fatura. Downgrades e cancelamentos entram em vigor ao fim do ciclo vigente: você mantém acesso até lá.
          </p>
          <p>
            Períodos parcialmente utilizados não são reembolsados, salvo nos casos previstos no Código de Defesa do Consumidor ou quando a Vianova der origem ao cancelamento.
          </p>

          <h2>3. Plano gratuito</h2>
          <p>
            O plano gratuito é para você avaliar o produto antes de assinar. Cada conta tem direito a <strong>um workspace gratuito por produto</strong>. Esse limite é vitalício: excluir o workspace gratuito não restaura o direito. Limites de uso (disparos, contatos, automações) variam por plano e estão nas páginas de preços de cada produto.
          </p>

          <h2>4. Uso aceitável</h2>
          <p>É proibido usar os produtos da Vianova para:</p>
          <ul>
            <li>Enviar mensagens não solicitadas a destinatários que não pediram para recebê-las.</li>
            <li>Transmitir conteúdo ilegal, difamatório, discriminatório ou que viole direitos de terceiros.</li>
            <li>Desrespeitar leis de proteção de dados, incluindo a LGPD (Lei 13.709/2018) e as políticas das plataformas de mensageria usadas (WhatsApp Business Policy, Telegram Terms of Service).</li>
            <li>Fazer engenharia reversa ou tentar obter o código-fonte de qualquer produto.</li>
            <li>Automatizar o cadastro de contas ou burlar limites de uso.</li>
            <li>Revender acesso às plataformas sem autorização da Vianova.</li>
          </ul>
          <p>
            Violar essas regras pode resultar em suspensão imediata da conta, sem reembolso do período não utilizado.
          </p>

          <h2>5. Propriedade intelectual</h2>
          <p>
            Software, design, textos e marcas dos produtos da Vianova pertencem à Vianova Software Ltda. ou a seus licenciadores. Usar os serviços não transfere nenhum direito de propriedade sobre esses elementos.
          </p>
          <p>
            Seus dados (contatos, campanhas, automações e tudo mais que você cria) continuam sendo seus. Ao usar os serviços, você concede à Vianova uma licença limitada, não exclusiva e revogável para armazenar e processar esses dados com o único fim de prestar o serviço contratado.
          </p>

          <h2>6. Disponibilidade</h2>
          <p>
            A Vianova não garante disponibilidade ininterrupta. Manutenções programadas são comunicadas com ao menos 24 horas de antecedência. Incidentes não planejados são acompanhados em tempo real em <strong>status.vianova.software</strong>.
          </p>
          <p>
            Indisponibilidades causadas por terceiros (provedores de cloud, plataformas de mensageria, processadores de pagamento) ou por força maior não geram responsabilidade para a Vianova.
          </p>

          <h2>7. Limitação de responsabilidade</h2>
          <p>
            Na extensão máxima permitida pela legislação brasileira, a responsabilidade total da Vianova por danos decorrentes do uso dos serviços fica limitada ao valor pago nos 3 meses anteriores ao evento que originou a reclamação.
          </p>
          <p>
            Danos indiretos, lucros cessantes, perda de dados e danos à reputação não são cobertos.
          </p>

          <h2>8. Privacidade</h2>
          <p>
            Nossa{' '}
            <Link to="/privacy" className="text-via-600 hover:text-via-700 underline-offset-2 hover:underline">
              Política de Privacidade
            </Link>
            {' '}descreve como tratamos dados pessoais e integra estes Termos por referência.
          </p>

          <h2>9. Alterações</h2>
          <p>
            A Vianova pode atualizar estes Termos. Mudanças relevantes chegam por e-mail com 15 dias de antecedência. Continuar usando os serviços depois desse prazo implica aceitação. Se discordar, cancele a conta antes do prazo.
          </p>

          <h2>10. Encerramento de conta</h2>
          <p>
            Você pode encerrar sua conta nas configurações a qualquer momento. Planos ativos são cancelados ao fim do período pago vigente. Seus dados são excluídos em até 90 dias após o encerramento, exceto onde a lei exige retenção.
          </p>
          <p>
            A Vianova pode suspender ou encerrar contas que violem estes Termos. Suspensões por má conduta não geram reembolso.
          </p>

          <h2>11. Lei aplicável e foro</h2>
          <p>
            Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro da Comarca de [cidade/UF da sede da empresa] para dirimir quaisquer controvérsias, renunciando as partes a qualquer outro.
          </p>

          <h2>12. Contato</h2>
          <p>
            Dúvidas: <a href="mailto:legal@vianova.software" className="text-via-600 hover:text-via-700">legal@vianova.software</a>.
          </p>
        </div>
      </main>

      <footer className="border-t border-line py-8">
        <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-ink-400">© 2026 Vianova Software Ltda. Todos os direitos reservados.</p>
          <div className="flex items-center gap-5 text-xs text-ink-400">
            <Link to="/terms" className="hover:text-ink-700 transition-colors">Termos de Uso</Link>
            <Link to="/privacy" className="hover:text-ink-700 transition-colors">Privacidade</Link>
          </div>
        </div>
      </footer>

      <style>{`
        .prose-legal p {
          color: #3d3648;
          font-size: 0.9375rem;
          line-height: 1.75;
          margin-top: 0;
          margin-bottom: 1.1rem;
        }
        .prose-legal h2 {
          font-family: var(--font-display, inherit);
          font-size: 1.125rem;
          font-weight: 700;
          color: #100d16;
          letter-spacing: -0.01em;
          margin-top: 2.25rem;
          margin-bottom: 0.75rem;
        }
        .prose-legal ul {
          padding-left: 1.35rem;
          margin-bottom: 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .prose-legal li {
          color: #3d3648;
          font-size: 0.9375rem;
          line-height: 1.65;
        }
        .prose-legal strong {
          color: #100d16;
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}
