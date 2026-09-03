export const metadata = {
  title: 'Exclusão de conta e dados — Missão Cumprida',
  description: 'Como solicitar a exclusão da sua conta e dos seus dados na Missão Cumprida.',
}

// Página PÚBLICA (sem login) exigida pelo Google Play para solicitação de
// exclusão de conta/dados. Conteúdo estático — não depende do backend.
const CONTACT_EMAIL = 'almir.seibert@gmail.com'

export default function ExclusaoDeContaPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 text-slate-700">
      <h1 className="text-2xl font-bold text-slate-900">Exclusão de conta e dados</h1>
      <p className="mt-2 text-sm text-slate-500">Missão Cumprida — aplicativo de serviços</p>

      <p className="mt-6">
        Você pode solicitar a exclusão da sua conta e dos seus dados pessoais a qualquer momento,
        por um dos caminhos abaixo.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3 text-slate-900">Opção 1 — Pelo aplicativo (imediato)</h2>
      <ol className="list-decimal pl-6 space-y-1">
        <li>Abra o app Missão Cumprida e faça login.</li>
        <li>Vá em <strong>Perfil</strong>.</li>
        <li>Toque em <strong>Excluir minha conta</strong>.</li>
        <li>Confirme com a sua senha.</li>
      </ol>
      <p className="mt-3">
        A conta é desativada e seus dados pessoais são anonimizados na hora. Não é possível excluir
        enquanto houver saldo a sacar ou pagamentos/serviços em andamento — finalize-os antes.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3 text-slate-900">Opção 2 — Por e-mail (se não conseguir acessar o app)</h2>
      <p>
        Envie um e-mail para{' '}
        <a href={`mailto:${CONTACT_EMAIL}?subject=Exclusão de conta`} className="text-brand-600 underline">
          {CONTACT_EMAIL}
        </a>{' '}
        a partir do <strong>e-mail cadastrado na sua conta</strong>, com o assunto
        “Exclusão de conta”. Concluímos a solicitação em até <strong>15 dias</strong> e confirmamos por e-mail.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3 text-slate-900">Quais dados são excluídos</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Nome, e-mail, telefone, CPF/RG e demais dados de perfil;</li>
        <li>Endereço, contatos de emergência e chave PIX;</li>
        <li>Foto de perfil e <strong>documentos de verificação (documento e selfie)</strong>.</li>
      </ul>

      <h2 className="text-xl font-bold mt-8 mb-3 text-slate-900">Quais dados podem ser retidos</h2>
      <p>
        Registros financeiros e de transações (pedidos, pagamentos, taxas) podem ser mantidos de
        forma <strong>anonimizada</strong> pelo prazo exigido por obrigações legais e fiscais, sem
        vinculação à sua identidade. Após esse prazo, são eliminados.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3 text-slate-900">Dúvidas</h2>
      <p>
        Fale com o Encarregado de Dados (DPO) por{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 underline">{CONTACT_EMAIL}</a>.
        Consulte também nossa{' '}
        <a href="/privacidade" className="text-brand-600 underline">Política de Privacidade</a>.
      </p>
    </main>
  )
}
