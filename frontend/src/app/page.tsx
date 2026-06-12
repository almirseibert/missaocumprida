import Link from 'next/link'
import {
  Clock, Shield, Star, CreditCard, Search, MessagesSquare,
  CheckCircle2, ShieldCheck, MapPin, ArrowRight,
} from 'lucide-react'
import { Logo } from '@/components/Logo'

export default function LandingPage() {
  const features = [
    {
      icon: <Clock className="w-5 h-5 text-brand-700" />,
      title: 'Rápido e Fácil',
      desc: 'Descreva o serviço e receba propostas de profissionais em minutos.',
      bg: 'bg-brand-50',
    },
    {
      icon: <Shield className="w-5 h-5 text-accent-600" />,
      title: 'Profissionais Verificados',
      desc: 'Documento e selfie conferidos antes de qualquer proposta.',
      bg: 'bg-accent-50',
    },
    {
      icon: <Star className="w-5 h-5 text-amber-600" />,
      title: 'Avaliação Dupla',
      desc: 'Cliente e prestador se avaliam — reputação real dos dois lados.',
      bg: 'bg-amber-100',
    },
    {
      icon: <CreditCard className="w-5 h-5 text-brand-700" />,
      title: 'Pagamento Protegido',
      desc: 'O valor fica retido e só é liberado quando você confirma a conclusão.',
      bg: 'bg-brand-50',
    },
  ]

  const categories = [
    { icon: '🧹', name: 'Limpeza' },
    { icon: '⚡', name: 'Elétrica' },
    { icon: '🔧', name: 'Encanamento' },
    { icon: '🪛', name: 'Montagem' },
    { icon: '🎨', name: 'Pintura' },
    { icon: '🚚', name: 'Fretes' },
    { icon: '💻', name: 'Tecnologia' },
    { icon: '🐾', name: 'Pets' },
    { icon: '💆', name: 'Beleza' },
    { icon: '📚', name: 'Aulas' },
    { icon: '🎉', name: 'Eventos' },
    { icon: '🌳', name: 'Jardim' },
  ]

  const steps = [
    {
      icon: <Search className="w-6 h-6 text-white" />,
      title: 'Descreva sua missão',
      desc: 'Responda perguntas rápidas sobre o serviço e veja na hora a faixa de preço estimada.',
    },
    {
      icon: <MessagesSquare className="w-6 h-6 text-white" />,
      title: 'Compare propostas',
      desc: 'Profissionais verificados da sua região enviam propostas. Veja avaliações e escolha.',
    },
    {
      icon: <CheckCircle2 className="w-6 h-6 text-white" />,
      title: 'Pague com segurança',
      desc: 'PIX ou cartão com valor protegido: só liberamos ao prestador quando você confirmar.',
    },
  ]

  const stats = [
    { value: '+2.400', label: 'Profissionais verificados' },
    { value: '+12 mil', label: 'Missões concluídas' },
    { value: '4.9★', label: 'Avaliação média' },
    { value: '100%', label: 'Pagamento protegido' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* ── Navbar ── */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate2-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={36} />
            <span className="font-display font-extrabold text-lg text-slate2-900">Missão Cumprida</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <a href="#como-funciona" className="font-display text-sm font-semibold text-slate2-600 hover:text-brand-700 transition-colors px-3 py-2 rounded-lg hover:bg-brand-50">
              Como funciona
            </a>
            <a href="#categorias" className="font-display text-sm font-semibold text-slate2-600 hover:text-brand-700 transition-colors px-3 py-2 rounded-lg hover:bg-brand-50">
              Categorias
            </a>
            <a href="#seguranca" className="font-display text-sm font-semibold text-slate2-600 hover:text-brand-700 transition-colors px-3 py-2 rounded-lg hover:bg-brand-50">
              Segurança
            </a>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="font-display text-sm font-semibold text-slate2-600 hover:text-slate2-900 transition-colors px-4 py-2"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="font-display text-sm font-semibold bg-brand-700 text-white px-5 py-2.5 rounded-lg hover:bg-brand-800 transition-all hover:shadow-brand-soft"
            >
              Cadastrar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden px-6 sm:px-12 py-20 sm:py-24"
        style={{
          background: 'linear-gradient(120deg, #1E40AF 0%, #1D4ED8 38%, #059669 100%)',
        }}
      >
        {/* brilhos decorativos */}
        <div
          aria-hidden
          className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #FFFFFF 0%, transparent 65%)' }}
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-24 w-[420px] h-[420px] rounded-full opacity-25 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #1E3A8A 0%, transparent 65%)' }}
        />

        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
          {/* Texto */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-white/15 border border-white/20 rounded-full px-4 py-1.5 mb-6 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              <span className="text-xs font-medium text-white/90">+2.400 profissionais verificados perto de você</span>
            </div>
            <h1 className="font-display font-extrabold text-white text-4xl sm:text-5xl md:text-[54px] leading-[1.06] tracking-tight mb-5">
              Todo serviço vira{' '}
              <span
                className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(90deg, #FDE68A, #FCD34D)' }}
              >
                missão cumprida
              </span>
            </h1>
            <p className="text-white/80 text-base sm:text-lg max-w-md mx-auto lg:mx-0 leading-relaxed mb-9">
              Descreva o que precisa, compare propostas de profissionais verificados e pague
              com segurança via PIX ou cartão — o valor só é liberado quando você aprovar.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
              <Link
                href="/register"
                className="group font-display font-semibold inline-flex items-center justify-center gap-2 bg-white text-brand-700 text-base px-7 py-3.5 rounded-xl hover:bg-brand-50 transition-all shadow-elv-3"
              >
                Contratar um serviço
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/register?tipo=prestador"
                className="font-display font-semibold inline-flex items-center justify-center border-2 border-white/60 text-white text-base px-7 py-3.5 rounded-xl hover:bg-white/10 transition-colors"
              >
                Quero trabalhar
              </Link>
            </div>
            <div className="flex items-center gap-3 justify-center lg:justify-start">
              <div className="flex -space-x-2">
                {['MC', 'AS', 'JP', 'RL'].map((ini, i) => (
                  <div
                    key={ini}
                    className="w-8 h-8 rounded-full border-2 border-white/40 flex items-center justify-center text-[10px] font-display font-bold text-white"
                    style={{ backgroundColor: ['#059669', '#2563EB', '#7C3AED', '#D97706'][i] }}
                  >
                    {ini}
                  </div>
                ))}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-[11px] text-white/75 mt-0.5">4.9 de média em +12 mil missões</p>
              </div>
            </div>
          </div>

          {/* Mock visual — cards flutuantes */}
          <div className="relative hidden lg:block h-[420px]" aria-hidden>
            {/* Card pedido */}
            <div className="absolute top-0 left-4 right-16 bg-white rounded-2xl shadow-elv-4 p-5 animate-mc-float">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🧹</span>
                <div>
                  <p className="font-display font-bold text-sm text-slate2-900">Limpeza pós-obra · 3 quartos</p>
                  <p className="text-[11px] text-slate2-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Centro · sábado, 14h
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-slate2-50 rounded-xl px-3.5 py-2.5">
                <span className="text-xs text-slate2-500">Estimativa</span>
                <span className="font-display font-extrabold text-sm text-brand-700">R$ 280 – R$ 350</span>
              </div>
            </div>

            {/* Card proposta */}
            <div className="absolute top-[150px] right-0 w-[290px] bg-white rounded-2xl shadow-elv-4 p-4 animate-mc-float-slow">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-accent-100 flex items-center justify-center font-display font-bold text-accent-700">
                  AN
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold text-[13px] text-slate2-900 flex items-center gap-1">
                    Ana Nogueira
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
                  </p>
                  <p className="text-[11px] text-slate2-500 flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> 4.9 · 213 missões
                  </p>
                </div>
                <span className="font-display font-extrabold text-sm text-accent-600">R$ 300</span>
              </div>
              <div className="mt-3 bg-brand-700 text-white text-center text-xs font-display font-semibold rounded-lg py-2">
                Aceitar proposta
              </div>
            </div>

            {/* Toast missão concluída */}
            <div className="absolute bottom-2 left-0 flex items-center gap-3 bg-white rounded-2xl shadow-elv-4 px-4 py-3.5 animate-mc-float">
              <div className="w-9 h-9 rounded-full bg-accent-50 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-accent-600" />
              </div>
              <div>
                <p className="font-display font-bold text-[13px] text-slate2-900">Missão cumprida! 🎉</p>
                <p className="text-[11px] text-slate2-500">Pagamento liberado para Ana</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-white border-b border-slate2-100 px-6 sm:px-12 py-10">
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="font-display text-3xl font-extrabold text-brand-700">{s.value}</div>
              <div className="text-[13px] text-slate2-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section id="como-funciona" className="bg-slate2-50 px-6 sm:px-12 py-16 scroll-mt-16">
        <div className="text-center mb-11">
          <div className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-brand-600 mb-2">
            Como funciona
          </div>
          <h2 className="font-display text-3xl font-extrabold text-slate2-900">
            Sua missão em 3 passos
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="relative bg-white border border-slate2-200 rounded-2xl p-7 hover:shadow-elv-2 hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #059669 100%)' }}
                >
                  {s.icon}
                </div>
                <span className="font-display text-4xl font-extrabold text-slate2-100 select-none">
                  0{i + 1}
                </span>
              </div>
              <h3 className="font-display font-bold text-lg text-slate2-900 mb-2">{s.title}</h3>
              <p className="text-sm text-slate2-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CATEGORIAS ── */}
      <section id="categorias" className="bg-white px-6 sm:px-12 py-16 scroll-mt-16">
        <div className="text-center mb-10">
          <div className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-brand-600 mb-2">
            Categorias
          </div>
          <h2 className="font-display text-3xl font-extrabold text-slate2-900">
            O que você precisa hoje?
          </h2>
          <p className="text-slate2-500 mt-2">Mais de 60 serviços em 10 grupos — da torneira ao banho do pet.</p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 max-w-5xl mx-auto">
          {categories.map((c) => (
            <Link
              key={c.name}
              href="/register"
              className="group text-center px-2 py-5 rounded-2xl border border-slate2-200 hover:border-brand-300 hover:bg-brand-50 hover:shadow-elv-1 hover:-translate-y-0.5 transition-all"
            >
              <div className="text-3xl mb-2 transition-transform group-hover:scale-110">{c.icon}</div>
              <div className="text-xs font-semibold text-slate2-700 group-hover:text-brand-700">{c.name}</div>
            </Link>
          ))}
        </div>
        <div className="text-center mt-7">
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            Ver todos os serviços <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── SEGURANÇA / FEATURES ── */}
      <section id="seguranca" className="bg-slate2-50 px-6 sm:px-12 py-16 scroll-mt-16">
        <div className="text-center mb-11">
          <div className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-accent-600 mb-2">
            Segurança
          </div>
          <h2 className="font-display text-3xl font-extrabold text-slate2-900">
            Confiança dos dois lados
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white border border-slate2-200 rounded-2xl p-6 hover:shadow-elv-2 hover:-translate-y-0.5 transition-all"
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

      {/* ── CTA FINAL ── */}
      <section
        className="px-6 sm:px-12 py-16 text-center"
        style={{ background: 'linear-gradient(135deg, #1E40AF 0%, #1D4ED8 55%, #047857 100%)' }}
      >
        <h2 className="font-display text-3xl sm:text-[34px] font-extrabold text-white mb-3">
          Pronto para sua primeira missão?
        </h2>
        <p className="text-white/75 text-base mb-8">
          Cadastre-se gratuitamente. Sem mensalidade, sem taxa de adesão.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/register"
            className="font-display font-semibold inline-block bg-white text-brand-700 text-base px-7 py-3.5 rounded-xl hover:bg-brand-50 transition-colors shadow-elv-3"
          >
            Criar conta grátis
          </Link>
          <Link
            href="/register?tipo=prestador"
            className="font-display font-semibold inline-block border-2 border-white/60 text-white text-base px-7 py-3.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            Trabalhar como prestador
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate2-900 px-6 sm:px-12 pt-12 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-[1.4fr_1fr_1fr] gap-10 pb-10 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <Logo size={30} />
                <span className="font-display font-bold text-white">Missão Cumprida</span>
              </div>
              <p className="text-sm text-slate2-400 leading-relaxed max-w-xs">
                O marketplace brasileiro de serviços locais com profissionais verificados
                e pagamento protegido.
              </p>
            </div>
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate2-400 mb-3">
                Navegação
              </h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#como-funciona" className="text-slate2-300 hover:text-white transition-colors">Como funciona</a></li>
                <li><a href="#categorias" className="text-slate2-300 hover:text-white transition-colors">Categorias</a></li>
                <li><a href="#seguranca" className="text-slate2-300 hover:text-white transition-colors">Segurança</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate2-400 mb-3">
                Para você
              </h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/register" className="text-slate2-300 hover:text-white transition-colors">Contratar serviço</Link></li>
                <li><Link href="/register?tipo=prestador" className="text-slate2-300 hover:text-white transition-colors">Trabalhar como prestador</Link></li>
                <li><Link href="/login" className="text-slate2-300 hover:text-white transition-colors">Entrar na conta</Link></li>
              </ul>
            </div>
          </div>
          <p className="text-sm text-slate2-500 pt-6 text-center sm:text-left">
            © 2026 Missão Cumprida. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
