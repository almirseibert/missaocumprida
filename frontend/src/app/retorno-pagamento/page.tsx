export const metadata = {
  title: 'Pagamento — Missão Cumprida',
  description: 'Retorno do pagamento da taxa de conexão.',
}

// Página PÚBLICA de retorno do Checkout Pro (cartão) do Mercado Pago. Quem
// paga pelo app volta aqui no navegador, sem sessão web: em vez de cair no
// login, oferecemos voltar ao app pelo deep link. A confirmação real vem pelo
// webhook — esta página só reflete o status informado na URL.
type Props = { searchParams: Promise<{ pedido?: string; status?: string; collection_status?: string }> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function RetornoPagamentoPage(props: Props) {
  const searchParams = await props.searchParams
  const orderId = searchParams.pedido && UUID_RE.test(searchParams.pedido) ? searchParams.pedido : null
  const status = searchParams.collection_status || searchParams.status || ''
  const approved = status === 'approved'
  const pending = status === 'pending' || status === 'in_process'

  const title = approved
    ? 'Pagamento aprovado!'
    : pending
      ? 'Pagamento em análise'
      : 'Pagamento não concluído'
  const text = approved
    ? 'Recebemos a confirmação. Volte ao app para acompanhar a liberação do contato.'
    : pending
      ? 'O Mercado Pago está processando o pagamento. Assim que for aprovado, avisamos no app.'
      : 'O pagamento não foi finalizado. Volte ao app para tentar novamente com Pix ou cartão.'

  return (
    <main className="max-w-md mx-auto px-4 py-16 text-center text-slate-700">
      <div className="text-5xl mb-4">{approved ? '✅' : pending ? '⏳' : '⚠️'}</div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-3">{text}</p>
      {orderId && (
        <a
          href={`missaocumprida://pedido/${orderId}`}
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white"
        >
          Voltar para o app
        </a>
      )}
      {orderId && (
        <a href={`/pagamento/${orderId}`} className="mt-3 block text-sm text-slate-500 underline">
          Estou usando o site
        </a>
      )}
    </main>
  )
}
