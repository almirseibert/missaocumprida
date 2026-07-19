'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

/**
 * Página PÚBLICA de cancelamento de assinatura + exclusão de dados (Remap 2.0).
 * O usuário informa e-mail e senha; o sistema cancela a assinatura (Selo Pro)
 * e agenda a exclusão dos dados com prazo legal de arrependimento de 7 dias
 * (é possível desfazer nesta mesma página dentro do prazo).
 */
export default function CancelarAssinaturaPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'cancel' | 'undo'>('cancel')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    if (mode === 'cancel' && !confirm(
      'Confirma o cancelamento da assinatura e o agendamento da exclusão da sua conta e dados?\n\nVocê terá 7 dias para desfazer.',
    )) return
    setBusy(true)
    setResult(null)
    try {
      const url = mode === 'cancel' ? '/users/cancel-subscription-and-delete' : '/users/undo-deletion'
      const res = await api.post(url, { email, password })
      setResult({ ok: true, message: res.data.message })
      setPassword('')
    } catch (err: any) {
      setResult({ ok: false, message: err?.response?.data?.message ?? 'Erro ao processar a solicitação' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-10 text-slate-700">
      <h1 className="text-2xl font-bold text-slate-900">Cancelar assinatura e excluir dados</h1>
      <p className="mt-2 text-sm text-slate-500">Missão Cumprida — aplicativo de serviços</p>

      <p className="mt-6 text-sm leading-relaxed">
        Informe os dados da sua conta para <strong>cancelar a assinatura</strong> (Selo
        Verificado Pro) e <strong>agendar a exclusão</strong> da conta e dos dados pessoais.
        Pelo direito de arrependimento, você tem <strong>7 dias</strong> para desfazer —
        depois disso os dados são anonimizados definitivamente.
      </p>

      <div className="mt-6 flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => { setMode('cancel'); setResult(null) }}
          className={`px-4 py-2 text-sm font-medium rounded-lg ${mode === 'cancel' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
        >
          Cancelar e excluir
        </button>
        <button
          onClick={() => { setMode('undo'); setResult(null) }}
          className={`px-4 py-2 text-sm font-medium rounded-lg ${mode === 'undo' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
        >
          Desfazer exclusão
        </button>
      </div>

      <form onSubmit={submit} className="mt-4 space-y-4 bg-white border border-slate-200 rounded-2xl p-6">
        <div>
          <label className="block text-sm font-medium text-slate-700">E-mail da conta</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            placeholder="voce@email.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className={`w-full rounded-xl py-3 font-semibold text-white ${
            mode === 'cancel' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
          } disabled:opacity-60`}
        >
          {busy
            ? 'Processando…'
            : mode === 'cancel'
              ? 'Cancelar assinatura e agendar exclusão'
              : 'Desfazer exclusão agendada'}
        </button>
      </form>

      {result && (
        <div className={`mt-4 rounded-xl border p-4 text-sm ${result.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {result.message}
        </div>
      )}

      <div className="mt-8 text-xs text-slate-500 space-y-2 leading-relaxed">
        <p>
          <strong>Assinou pelo Google Play?</strong> Cancele também a renovação em
          Play Store → Assinaturas, para não haver novas cobranças.
        </p>
        <p>
          Não é possível concluir a exclusão enquanto houver saldo a sacar ou
          serviços/pagamentos em andamento. Registros financeiros são mantidos de forma
          anonimizada pelo prazo legal. Detalhes em{' '}
          <a href="/exclusao-de-conta" className="text-brand-600 underline">exclusão de conta e dados</a>{' '}
          e na <a href="/privacidade" className="text-brand-600 underline">política de privacidade</a>.
        </p>
      </div>
    </main>
  )
}
