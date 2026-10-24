import { renderMarkdown } from '@/lib/markdown'
import { TERMS_FALLBACK } from '@/lib/legal-fallback'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Termos de Uso — Missão Cumprida' }

async function getDoc() {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'
  try {
    const res = await fetch(`${base}/api/legal/terms`, { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    return json.data as { title: string; effective_date: string; body: string }
  } catch {
    return null
  }
}

export default async function TermosPage() {
  // Se a API estiver indisponível, usa a cópia estática — a página legal
  // pública nunca deve renderizar erro.
  const doc = (await getDoc()) ?? TERMS_FALLBACK
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">{doc.title}</h1>
      <p className="text-sm text-slate-500 mt-1">Vigente desde {doc.effective_date.split('-').reverse().join('/')}</p>
      <article className="mt-6">{renderMarkdown(doc.body)}</article>
    </main>
  )
}
