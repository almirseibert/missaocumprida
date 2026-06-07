import Link from 'next/link'
import { Clock, Shield, Star, CreditCard } from 'lucide-react'
import { Logo } from '@/components/Logo'

export default function LandingPage() {
  const features = [
    { icon: <Clock className="w-5 h-5 text-brand-700" />,    title: 'Rápido e Fácil',    desc: 'Descreva o serviço e receba propostas em minutos.',   bg: 'bg-brand-50'  },
    { icon: <Shield className="w-5 h-5 text-accent-600" />,  title: 'Verificados',       desc: 'Todos os profissionais passam por verificação.',       bg: 'bg-accent-50' },
    { icon: <Star className="w-5 h-5 text-amber-600" />,     title: 'Avaliação Dupla',   desc: 'Cliente e prestador se avaliam mutuamente.',           bg: 'bg-amber-100' },
    { icon: <CreditCard className="w-5 h-5 text-brand-700"/>,title: 'Pagamento Seguro',  desc: 'Escrow protege o pagamento até a conclusão.',          bg: 'bg-brand-50'  },
  ]

  const categories = [
    { icon: '🏠', name: 'Casa' },
    { icon: '🚗', name: 'Carro' },
    { icon: '💆', name: 'Você' },
    { icon: '🐾', name: 'Pet' },
    { icon: '💻', name: 'Tech' },
    { icon: '📦', name: 'Entrega' },
    { icon: '🎉', name: 'Eventos' },
    { icon: '📚', name: 'Educação' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* ── Navbar ── */}
      <header className="bg-white border-b border-slate2-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={36} />
            <span className="font-display font-extrabold text-lg text-slate2-900">Missão Cumprida</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="font-display text-sm font-semibold text-slate2-600 hover:text-slate2-900 transition-colors px-4 py-2"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="font-display text-sm font-semibold bg-brand-700 text-white px-5 py-2.5 rounded-lg hover:bg-brand-800 transition-colors"
            >
              Cadastrar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO — fundo escuro institucional ── */}
      <section
        className="px-6 sm:px-12 py-20 sm:py-24 text-center"
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 55%, #1D4ED8 100%)',
        }}
      >
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 mb-6 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
          <span className="text-xs font-medium text-white/85">+2.400 profissionais verificados</span>
        </div>
        <h1 className="font-display font-extrabold text-white text-4xl sm:text-5xl md:text-[52px] max-w-2xl mx-auto leading-[1.08] tracking-tight mb-5">
          Profissionais verificados para qualquer serviço
        </h1>
        <p className="text-white/70 text-base sm:text-lg max-w-md mx-auto leading-relaxed mb-10">
          Descreva o que precisa, receba propostas e pague com segurança via PIX ou cartão.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/register"
            className="font-display font-semibold bg-white text-brand-700 text-base px-7 py-3.5 rounded-xl hover:bg-brand-50 transition-colors"
          >
            Contratar um serviço
          </Link>
          <Link
            href="/register?tipo=prestador"
            className="font-display font-semibold border-2 border-white/60 text-white text-base px-7 py-3.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            Sou prestador de serviço
          </Link>
        </div>
      </section>

      {/* ── CATEGORIAS ── */}
      <section className="bg-white px-6 sm:px-12 py-14">
        <div className="text-center mb-9">
          <div className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-brand-600 mb-2">
            Categorias
          </div>
          <h2 className="font-display text-3xl font-extrabold text-slate2-900">
            O que você precisa hoje?
          </h2>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 max-w-5xl mx-auto">
          {categories.map((c) => (
            <Link
              key={c.name}
              href="/register"
              className="text-center px-2 py-5 rounded-2xl border border-slate2-200 hover:border-brand-300 hover:bg-brand-50 transition-all"
            >
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="text-xs font-semibold text-slate2-700">{c.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="bg-slate2-50 px-6 sm:px-12 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white border border-slate2-200 rounded-2xl p-6"
            >
              <div className={`w-11 h-11 ${f.bg} rounded-xl flex items-center justify-center mb-3.5`}>
                {f.icon}
              </div>
              <h3 className="font-display font-bold text-slate2-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate2-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL — azul sólido ── */}
      <section className="bg-brand-700 px-6 sm:px-12 py-14 text-center">
        <h2 className="font-display text-3xl sm:text-[32px] font-extrabold text-white mb-3">
          Pronto para sua primeira missão?
        </h2>
        <p className="text-white/70 text-base mb-7">
          Cadastre-se gratuitamente. Sem mensalidade, sem taxa de adesão.
        </p>
        <Link
          href="/register"
          className="font-display font-semibold inline-block bg-white text-brand-700 text-base px-7 py-3.5 rounded-xl hover:bg-brand-50 transition-colors"
        >
          Criar conta grátis
        </Link>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate2-200 px-6 sm:px-12 py-8 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-display font-bold text-slate2-900">Missão Cumprida</span>
          </div>
          <p className="text-sm text-slate2-500">© 2026 Missão Cumprida. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
