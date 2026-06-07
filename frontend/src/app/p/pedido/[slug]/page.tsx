import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Calendar, Camera, ExternalLink } from 'lucide-react'

interface PublicOrder {
  id: string
  title: string
  description: string | null
  category: { name: string; icon: string; pricing_unit?: string | null }
  location: { neighborhood: string | null; city: string; state: string }
  desired_date: string | null
  estimated_price_min: number | null
  estimated_price_max: number | null
  photos: string[]
  status: string
  created_at: string
  proposals_count: number
  client: { first_name: string; avatar: string | null; rating_avg: number; rating_count: number }
}

interface Props { params: { slug: string } }

async function fetchOrder(slug: string): Promise<PublicOrder | null> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'
  try {
    const r = await fetch(`${API_URL}/api/public/orders/${slug}`, { cache: 'no-store' })
    if (!r.ok) return null
    const json = await r.json()
    return json.data as PublicOrder
  } catch {
    return null
  }
}

function fmt(value: number | null | undefined): string {
  if (value == null) return 'R$ —'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export async function generateMetadata({ params }: Props) {
  const order = await fetchOrder(params.slug)
  if (!order) return { title: 'Pedido — Missão Cumprida' }
  return {
    title: `${order.title} — Missão Cumprida`,
    description: order.description || `${order.category.name} em ${order.location.city}`,
    openGraph: {
      title: order.title,
      description: order.description || `${order.category.name} em ${order.location.city}`,
      images: order.photos[0] ? [order.photos[0]] : [],
    },
  }
}

export default async function PublicOrderPage({ params }: Props) {
  const order = await fetchOrder(params.slug)
  if (!order) notFound()

  const localText = [order.location.neighborhood, order.location.city, order.location.state]
    .filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate2-50 to-white">
      <header className="px-4 py-4 border-b bg-white">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-brand-700">Missão Cumprida</Link>
          <Link href="/login" className="text-sm text-slate2-600 hover:text-slate2-900">Entrar</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Header do pedido */}
        <div className="flex items-start gap-3 mb-2">
          <div className="text-3xl">{order.category.icon}</div>
          <div className="flex-1">
            <div className="text-xs text-slate2-500 uppercase tracking-wide">{order.category.name}</div>
            <h1 className="text-2xl font-bold text-slate2-900">{order.title}</h1>
          </div>
        </div>

        <div className="text-sm text-slate2-600 flex items-center gap-3 mb-6 flex-wrap">
          <span className="flex items-center gap-1"><MapPin size={14} /> {localText}</span>
          {order.desired_date && (
            <span className="flex items-center gap-1">
              <Calendar size={14} /> {new Date(order.desired_date).toLocaleDateString('pt-BR')}
            </span>
          )}
          <span>{order.proposals_count} propostas até agora</span>
        </div>

        {/* Estimativa */}
        <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5 mb-6">
          <div className="text-xs text-brand-700 uppercase tracking-wide font-semibold">Faixa estimada</div>
          <div className="text-3xl font-extrabold text-brand-800 mt-1">
            {fmt(order.estimated_price_min)} <span className="text-lg font-normal text-brand-500">–</span> {fmt(order.estimated_price_max)}
            {order.category.pricing_unit && <span className="text-base text-brand-500 ml-1">/ {order.category.pricing_unit}</span>}
          </div>
        </div>

        {/* Descrição */}
        {order.description && (
          <div className="mb-6">
            <h2 className="font-semibold mb-2">Descrição</h2>
            <p className="text-slate2-700 whitespace-pre-wrap">{order.description}</p>
          </div>
        )}

        {/* Fotos */}
        {order.photos.length > 0 && (
          <div className="mb-8">
            <h2 className="font-semibold mb-2 flex items-center gap-2"><Camera size={16} /> Fotos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {order.photos.map((p, i) => (
                <img key={i} src={p} alt={`Foto ${i + 1}`} className="rounded-xl w-full aspect-square object-cover" />
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="bg-white border-2 border-emerald-300 rounded-3xl p-6 text-center">
          <div className="text-sm text-slate2-500 uppercase tracking-wide">É prestador?</div>
          <h2 className="text-xl font-bold text-slate2-900 mt-1 mb-2">
            Envie sua proposta para este pedido
          </h2>
          <p className="text-slate2-600 mb-4">
            Cadastre-se grátis em menos de 1 minuto e mande seu orçamento.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register?tipo=prestador"
              className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
            >
              Quero fazer uma proposta
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 rounded-xl border border-slate2-300 font-semibold hover:bg-slate2-50 flex items-center justify-center gap-2"
            >
              Já tenho conta <ExternalLink size={16} />
            </Link>
          </div>
        </div>

        <div className="text-xs text-slate2-400 text-center mt-6">
          Publicado por <strong>{order.client.first_name}</strong> · {new Date(order.created_at).toLocaleDateString('pt-BR')}
        </div>
      </main>
    </div>
  )
}
