import Link from 'next/link'
import { CheckCircle2, Star, Shield, Zap } from 'lucide-react'

export default function LandingPage() {
  const features = [
    { icon: <Zap className="w-6 h-6 text-brand-500" />, title: 'Rápido e Fácil', desc: 'Descreva o serviço e receba propostas em minutos.' },
    { icon: <Shield className="w-6 h-6 text-brand-500" />, title: 'Prestadores Verificados', desc: 'Todos os profissionais são verificados pela plataforma.' },
    { icon: <Star className="w-6 h-6 text-brand-500" />, title: 'Avaliação Dupla', desc: 'Clientes e prestadores se avaliam mutuamente após cada serviço.' },
    { icon: <CheckCircle2 className="w-6 h-6 text-brand-500" />, title: 'Pagamento Seguro', desc: 'Seu dinheiro fica protegido até a conclusão do serviço.' },
  ]

  const categories = [
    { icon: '🏠', name: 'Para sua Casa' },
    { icon: '🚗', name: 'Para seu Carro' },
    { icon: '💆', name: 'Para Você' },
    { icon: '🐾', name: 'Para seu Pet' },
    { icon: '💻', name: 'Tech e Digital' },
    { icon: '📦', name: 'Entregas' },
    { icon: '🎉', name: 'Eventos' },
    { icon: '📚', name: 'Educação' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <span className="font-bold text-xl text-gray-900">Missão Cumprida</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Entrar
            </Link>
            <Link
              href="/register"
              className="bg-brand-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-600 transition-colors"
            >
              Cadastrar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-50 to-orange-50 py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Encontre o profissional certo para{' '}
            <span className="text-brand-500">qualquer serviço</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10">
            Conectamos você a prestadores de serviço verificados, com preço justo, agendamento fácil e pagamento seguro.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="bg-brand-500 text-white text-base font-semibold px-8 py-4 rounded-xl hover:bg-brand-600 transition-colors shadow-lg shadow-brand-200"
            >
              Contratar um serviço
            </Link>
            <Link
              href="/register?tipo=prestador"
              className="border-2 border-brand-500 text-brand-600 text-base font-semibold px-8 py-4 rounded-xl hover:bg-brand-50 transition-colors"
            >
              Sou prestador de serviço
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Categorias de Serviços
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                href="/register"
                className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all group"
              >
                <span className="text-4xl">{cat.icon}</span>
                <span className="text-sm font-medium text-gray-700 group-hover:text-brand-600 text-center">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Por que usar a Missão Cumprida?
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-brand-500">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Pronto para começar?
          </h2>
          <p className="text-brand-100 mb-8">
            Cadastre-se gratuitamente e solicite seu primeiro serviço hoje.
          </p>
          <Link
            href="/register"
            className="bg-white text-brand-600 font-semibold px-8 py-4 rounded-xl hover:bg-brand-50 transition-colors inline-block"
          >
            Criar conta grátis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">✅</span>
            <span className="font-bold text-gray-900">Missão Cumprida</span>
          </div>
          <p className="text-sm text-gray-500">© 2025 Missão Cumprida. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
