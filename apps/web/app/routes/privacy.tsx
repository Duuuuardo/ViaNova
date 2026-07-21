import { createFileRoute, Link } from '@tanstack/react-router'
import { ViaLogo } from '../components/brand'
import { createHeadConfig } from '../lib/seo'

export const Route = createFileRoute('/privacy')({
  head: () => createHeadConfig('Política de Privacidade — Vianova'),
  component: PrivacidadePage,
})

function PrivacidadePage() {
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
          <h1 className="text-3xl font-display font-bold text-ink-900 tracking-tight">Política de Privacidade</h1>
          <p className="mt-2 text-sm text-ink-400">Última atualização: 20 de julho de 2026 · em conformidade com a LGPD (Lei 13.709/2018)</p>
        </div>

        <div className="prose-legal">
          <p>
            Esta Política descreve como a <strong>Vianova Software Ltda.</strong> ("Vianova") coleta, usa e compartilha dados pessoais de quem acessa Naia Campaigns, Naia CRM ou qualquer produto futuro da plataforma.
          </p>
          <p>
            A Vianova é a <strong>controladora</strong> dos dados de seus usuários. Os dados de contatos finais gerenciados dentro dos produtos (leads, destinatários) são de responsabilidade do próprio usuário perante seus contatos.
          </p>

          <h2>1. Dados que coletamos</h2>
          <p>
            <strong>Fornecidos por você:</strong> nome, e-mail e senha ao criar a conta; dados de faturamento (CPF/CNPJ, endereço) para emissão de nota fiscal; informações que você preenche no perfil ou nas configurações.
          </p>
          <p>
            <strong>Gerados pelo uso:</strong> registros de acesso (IP, data/hora, dispositivo, navegador), ações na plataforma (workspaces criados, campanhas disparadas, conexões configuradas), logs de autenticação e tentativas de 2FA, dados de sessão em cookies seguros (HttpOnly, Secure, SameSite=Strict).
          </p>
          <p>
            <strong>Faturamento:</strong> o Stripe processa os dados de cartão diretamente. A Vianova não armazena número de cartão, CVV ou dados bancários; recebemos apenas tokens de referência e status de pagamento.
          </p>
          <p>
            <strong>Conexões de mensageria:</strong> ao conectar WhatsApp ou Telegram, armazenamos só os identificadores necessários para manter a conexão ativa (número de telefone, session tokens). O conteúdo das conversas individuais não é inspecionado nem armazenado, exceto logs de status de entrega de campanhas.
          </p>

          <h2>2. Para que usamos os dados</h2>
          <p>Usamos seus dados pessoais para:</p>
          <ul>
            <li>Prestar os serviços: autenticar sessões, processar pagamentos, sincronizar entitlements entre produtos.</li>
            <li>Comunicar o necessário: faturas, alertas de segurança, mudanças nos Termos de Uso, avisos de manutenção.</li>
            <li>Prevenir fraudes: detectar contas automatizadas, uso indevido do plano gratuito e violações dos Termos.</li>
            <li>Cumprir obrigações legais: retenção de logs conforme o Marco Civil da Internet (Lei 12.965/2014) e obrigações tributárias.</li>
          </ul>
          <p>
            Não usamos seus dados para treinar modelos de inteligência artificial de terceiros. Não os vendemos.
          </p>

          <h2>3. Base legal</h2>
          <p>Cada tratamento tem uma base legal específica na LGPD:</p>
          <ul>
            <li><strong>Execução de contrato</strong> (art. 7º, V): criação de conta, autenticação de sessões, prestação dos serviços.</li>
            <li><strong>Legítimo interesse</strong> (art. 7º, IX): logs de segurança, prevenção a fraudes, comunicações operacionais.</li>
            <li><strong>Obrigação legal</strong> (art. 7º, II): retenção de registros de acesso e dados fiscais.</li>
            <li><strong>Consentimento</strong> (art. 7º, I): e-mails de marketing e novidades sobre produtos. Você pode revogar nas configurações de notificação a qualquer momento.</li>
          </ul>

          <h2>4. Com quem compartilhamos</h2>
          <p>Compartilhamos dados pessoais apenas com:</p>
          <ul>
            <li><strong>Stripe Inc.:</strong> processamento de pagamentos. Os dados de cartão vão diretamente aos servidores do Stripe, certificados PCI DSS Level 1.</li>
            <li><strong>Provedores de infraestrutura cloud:</strong> hospedagem de servidores e banco de dados, todos com contratos de processamento de dados (DPA) vigentes.</li>
            <li><strong>Autoridades competentes:</strong> quando exigido por lei ou ordem judicial.</li>
          </ul>
          <p>
            Não compartilhamos dados com empresas de marketing, data brokers ou qualquer terceiro que os use para fins comerciais próprios.
          </p>

          <h2>5. Transferências internacionais</h2>
          <p>
            Alguns fornecedores de infraestrutura operam servidores fora do Brasil. Garantimos que essas transferências usem mecanismos de proteção adequados: cláusulas contratuais padrão aprovadas pela ANPD ou certificações equivalentes. Dados de usuários brasileiros ficam preferencialmente em servidores no Brasil ou na União Europeia.
          </p>

          <h2>6. Por quanto tempo guardamos</h2>
          <ul>
            <li>Conta ativa: enquanto a conta existir.</li>
            <li>Logs de acesso: 6 meses (Marco Civil da Internet).</li>
            <li>Dados fiscais: 5 anos (obrigação tributária).</li>
            <li>Conta encerrada: excluídos em até 90 dias, exceto o que a lei exigir reter.</li>
          </ul>
          <p>
            Para solicitar exclusão antecipada de dados não sujeitos a retenção legal: <a href="mailto:contato@vianova.software" className="text-via-600 hover:text-via-700">contato@vianova.software</a>.
          </p>

          <h2>7. Seus direitos</h2>
          <p>
            Pelo suporte, você pode exercer a qualquer momento:
          </p>
          <ul>
            <li><strong>Acesso:</strong> saber quais dados temos sobre você.</li>
            <li><strong>Correção:</strong> atualizar dados incompletos ou desatualizados.</li>
            <li><strong>Portabilidade:</strong> receber seus dados em formato legível por máquina.</li>
            <li><strong>Eliminação:</strong> excluir dados tratados com base em consentimento.</li>
            <li><strong>Revogação:</strong> interromper comunicações de marketing nas configurações da conta.</li>
            <li><strong>Oposição:</strong> contestar tratamento baseado em legítimo interesse, com justificativa.</li>
            <li><strong>Informação:</strong> saber com quem compartilhamos seus dados.</li>
          </ul>
          <p>
            Respondemos em até 15 dias úteis. Em casos complexos, esse prazo pode ser estendido por mais 15 dias, com aviso prévio.
          </p>

          <h2>8. Segurança</h2>
          <p>
            Senhas armazenadas com bcrypt (custo ≥ 12). Tokens de sessão com rotação automática. Comunicação via HTTPS/TLS 1.3. Acesso ao banco de dados restrito por rede privada. 2FA disponível para todos os usuários.
          </p>
          <p>
            Incidentes que afetem dados pessoais são notificados à ANPD e aos titulares no prazo previsto na LGPD.
          </p>

          <h2>9. Cookies</h2>
          <p>
            Usamos apenas cookies de sessão, necessários para manter você autenticado. Sem cookies de rastreamento publicitário, sem pixels de terceiros. O cookie de sessão usa HttpOnly, Secure e SameSite=Strict para prevenir CSRF e XSS.
          </p>

          <h2>10. Alterações</h2>
          <p>
            Mudanças relevantes nesta Política chegam por e-mail com 15 dias de antecedência. A versão vigente fica sempre em <strong>vianova.software/privacy</strong> com a data da última atualização.
          </p>

          <h2>11. DPO</h2>
          <p>
            Nossa encarregada de proteção de dados: <a href="mailto:contato@vianova.software" className="text-via-600 hover:text-via-700">contato@vianova.software</a>. Você também pode registrar reclamações diretamente na ANPD em <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-via-600 hover:text-via-700">gov.br/anpd</a>.
          </p>

          <h2>12. Controladora</h2>
          <p>
            <strong>Vianova Software Ltda.</strong><br />
<a href="mailto:contato@vianova.software" className="text-via-600 hover:text-via-700">contato@vianova.software</a>
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
        .prose-legal a {
          transition: color 120ms;
        }
      `}</style>
    </div>
  )
}
