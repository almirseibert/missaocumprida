import Link from 'next/link'
import { Gift } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'

interface PageProps { params: { code: string } }

async function fetchInviter(code: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'
  try {
    const r = await fetch(`${API_URL}/api/referrals/lookup/${code}`, { cache: 'no-store' })
    if (!r.ok) return null
    const json = await r.json()
    return json.data as { name: string; avatar: string | null; code: string }
  } catch {
    return null
  }
}

export default async function ConvitePage({ params }: PageProps) {
  const code = params.code.toUpperCase()
  const inviter = await fetchInviter(code)

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-emerald-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate2-200 shadow-xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 mx-auto flex items-center justify-center mb-4">
          <Gift className="text-emerald-700" size={28} />
        </div>
        {inviter ? (
          <>
            <Avatar name={inviter.name} avatar={inviter.avatar ?? undefined} size="lg" className="mx-auto mb-3" />
            <h1 className="text-xl font-bold mb-1">
              {inviter.name.split(' ')[0]} convidou você
            </h1>
            <p className="text-slate2-600 mb-4">
              Crie sua conta no <strong>Missão Cumprida</strong> usando o código <span className="font-mono font-bold text-brand-700">{code}</span>. Conforme você contrata serviços, vocês dois ganham <strong>crédito</strong> na plataforma.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-2">Convite para o Missão Cumprida</h1>
            <p className="text-slate2-600 mb-4">
              Encontre os melhores profissionais para qualquer serviço perto de você. Crie sua conta para começar.
            </p>
          </>
        )}

        <div className="space-y-3">
          <Link
            href={`/register?codigo=${code}&tipo=cliente`}
            className="block w-full px-5 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700"
          >
            Quero contratar serviços
          </Link>
          <Link
            href={`/register?codigo=${code}&tipo=prestador`}
            className="block w-full px-5 py-3 rounded-xl border border-slate2-300 font-semibold hover:bg-slate2-50"
          >
            Quero ganhar como prestador
          </Link>
          <Link href="/login" className="block text-sm text-slate2-500 hover:text-slate2-700 pt-2">
            Já tenho conta
          </Link>
        </div>
      </div>
    </div>
  )
}
