'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Search, Check, AlertCircle, X, ArrowRight,
  CheckCircle2, Star, Shield, Zap, Loader2,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

// =============================================================================
// /design-system — espelho navegável da Identidade Visual.html
// =============================================================================

const SECTIONS = [
  { id: 'logo',     group: 'Fundação',   label: 'Logo' },
  { id: 'cores',    group: 'Fundação',   label: 'Cores' },
  { id: 'tipografia', group: 'Fundação', label: 'Tipografia' },
  { id: 'botoes',   group: 'Componentes', label: 'Botões' },
  { id: 'inputs',   group: 'Componentes', label: 'Inputs' },
  { id: 'badges',   group: 'Componentes', label: 'Badges e Tags' },
  { id: 'cards',    group: 'Componentes', label: 'Cards' },
  { id: 'elevacao', group: 'Componentes', label: 'Elevação' },
  { id: 'raios',    group: 'Componentes', label: 'Border Radius' },
  { id: 'espacamento', group: 'Componentes', label: 'Espaçamento' },
]

const groups = Array.from(new Set(SECTIONS.map((s) => s.group)))

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-slate2-50 text-slate2-900 flex">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-screen w-56 bg-white border-r border-slate2-200 overflow-y-auto z-10 flex flex-col">
        <Link href="/" className="flex items-center gap-2.5 p-5 border-b border-slate2-100">
          <Logo size={32} />
          <div>
            <div className="font-display font-extrabold text-sm leading-tight">Missão Cumprida</div>
            <div className="text-[10px] font-normal text-slate2-400 tracking-widest uppercase">Guia de Identidade</div>
          </div>
        </Link>
        {groups.map((g) => (
          <div key={g}>
            <div className="px-3 pt-5 pb-1 text-[10px] font-bold tracking-widest uppercase text-slate2-400">{g}</div>
            {SECTIONS.filter((s) => s.group === g).map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2 mx-2 my-px px-3 py-2 rounded-lg text-[13px] font-medium text-slate2-600 hover:bg-brand-50 hover:text-brand-700 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                {s.label}
              </a>
            ))}
          </div>
        ))}
        <div className="mt-auto px-5 py-4 border-t border-slate2-100 text-[10px] text-slate2-400">
          <Link href="/" className="hover:text-brand-700 transition-colors">← Voltar ao app</Link>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-56 flex-1 px-12 py-14 max-w-[1120px]">
        <LogoSection />
        <ColorsSection />
        <TypographySection />
        <ButtonsSection />
        <InputsSection />
        <BadgesSection />
        <CardsSection />
        <ElevationSection />
        <RadiusSection />
        <SpacingSection />
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function Section({ id, eyebrow, title, sub, children }: {
  id: string; eyebrow: string; title: string; sub?: string; children: React.ReactNode
}) {
  return (
    <section id={id} className="mb-22 scroll-mt-8" style={{ marginBottom: '88px' }}>
      <header className="mb-9">
        <div className="font-display text-[11px] font-bold tracking-[0.15em] uppercase text-brand-600 mb-1.5">{eyebrow}</div>
        <h1 className="font-display text-[32px] font-extrabold leading-[1.1] text-slate2-900">{title}</h1>
        {sub && <p className="text-[15px] text-slate2-500 mt-2 leading-relaxed max-w-xl">{sub}</p>}
      </header>
      {children}
    </section>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-slate2-200 rounded-2xl overflow-hidden ${className}`}>{children}</div>
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-slate2-400 mb-4">{children}</div>
}

// ---------------------------------------------------------------------------
// 01 — LOGO
// ---------------------------------------------------------------------------
function LogoSection() {
  const sizes = [128, 64, 40, 32, 24, 20]
  const bgs = [
    { name: 'Fundo claro', cls: 'bg-white border border-slate2-200' },
    { name: 'Fundo escuro', cls: 'bg-slate2-900' },
    { name: 'Fundo brand',  cls: 'bg-brand-700' },
    { name: 'Gradiente',    cls: 'bg-gradient-to-br from-brand-800 to-accent-700' },
  ]
  return (
    <Section
      id="logo"
      eyebrow="01 — Fundação"
      title="Logo"
      sub="O símbolo combina um checkmark bold com forma quadrada arredondada. O degradê azul→verde reforça a transição de confiança (azul) para conclusão bem-sucedida (verde)."
    >
      <Card className="mb-4">
        <div className="p-7">
          <Label>Símbolo — escala de tamanho</Label>
          <div className="flex items-end gap-8 px-2">
            {sizes.map((s) => (
              <div key={s} className="flex flex-col items-center gap-2">
                <Logo size={s} />
                <span className="text-[10px] font-mono text-slate2-400">{s}px</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="p-7">
          <Label>Símbolo sobre diferentes fundos</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {bgs.map((bg) => (
              <div key={bg.name}>
                <div className={`rounded-xl py-10 flex items-center justify-center ${bg.cls}`}>
                  <Logo size={64} />
                </div>
                <p className="text-[11px] text-slate2-500 mt-2 text-center">{bg.name}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-7">
          <Label>Lockup — horizontal e vertical</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-slate2-200 rounded-xl p-10 flex items-center justify-center gap-3.5">
              <Logo size={48} />
              <div>
                <div className="font-display font-extrabold text-[22px] leading-none text-slate2-900">Missão Cumprida</div>
                <div className="text-[11px] font-medium tracking-[0.18em] uppercase text-slate2-500 mt-1">Marketplace de serviços</div>
              </div>
            </div>
            <div className="bg-slate2-900 rounded-xl p-10 flex flex-col items-center justify-center gap-2.5">
              <Logo size={56} />
              <div className="font-display font-extrabold text-[22px] leading-none text-white">Missão Cumprida</div>
              <div className="text-[11px] text-white/50 text-center">Conectando pessoas que cumprem missões</div>
            </div>
          </div>
        </div>
      </Card>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 02 — CORES
// ---------------------------------------------------------------------------
const palettes = [
  {
    name: 'Azul Confiança',
    role: 'Primary · brand',
    scale: [
      { n: 50,  hex: '#EFF6FF' }, { n: 100, hex: '#DBEAFE' }, { n: 200, hex: '#BFDBFE' },
      { n: 300, hex: '#93C5FD' }, { n: 400, hex: '#60A5FA' }, { n: 500, hex: '#3B82F6' },
      { n: 600, hex: '#2563EB' }, { n: 700, hex: '#1D4ED8', primary: true },
      { n: 800, hex: '#1E40AF' }, { n: 900, hex: '#1E3A8A' },
    ],
  },
  {
    name: 'Verde Missão',
    role: 'Accent · success',
    scale: [
      { n: 50,  hex: '#ECFDF5' }, { n: 100, hex: '#D1FAE5' }, { n: 300, hex: '#6EE7B7' },
      { n: 500, hex: '#10B981' }, { n: 600, hex: '#059669', primary: true },
      { n: 700, hex: '#047857' }, { n: 900, hex: '#064E3B' },
    ],
  },
  {
    name: 'Ardósia',
    role: 'Neutros · slate',
    scale: [
      { n: 50,  hex: '#F8FAFC' }, { n: 100, hex: '#F1F5F9' }, { n: 200, hex: '#E2E8F0' },
      { n: 300, hex: '#CBD5E1' }, { n: 400, hex: '#94A3B8' }, { n: 500, hex: '#64748B' },
      { n: 600, hex: '#475569' }, { n: 700, hex: '#334155' },
      { n: 800, hex: '#1E293B' }, { n: 900, hex: '#0F172A' },
    ],
  },
]

const semantic = [
  { name: 'Sucesso',  hex: '#059669', cls: 'bg-accent-600' },
  { name: 'Aviso',    hex: '#D97706', cls: 'bg-amber-600'  },
  { name: 'Erro',     hex: '#DC2626', cls: 'bg-red-600'    },
  { name: 'Info',     hex: '#1D4ED8', cls: 'bg-brand-700'  },
]

function ColorsSection() {
  return (
    <Section
      id="cores"
      eyebrow="01 — Fundação"
      title="Cores"
      sub="A paleta gira em torno do Azul Confiança como cor primária e do Verde Missão como acento de conclusão. Os neutros ardósia dão estrutura sem competir."
    >
      {palettes.map((p) => (
        <Card key={p.name} className="mb-4">
          <div className="p-7">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="font-display text-base font-bold text-slate2-900">{p.name}</h3>
              <span className="text-[10px] font-mono text-slate2-400">{p.role}</span>
            </div>
            <div className="flex rounded-xl overflow-hidden h-[72px] mt-4">
              {p.scale.map((sw) => (
                <div
                  key={sw.n}
                  className="flex-1 relative"
                  style={{ background: sw.hex }}
                >
                  {sw.primary && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold tracking-wider text-white/90">
                      ★
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex mt-2">
              {p.scale.map((sw) => (
                <div key={sw.n} className="flex-1 flex flex-col gap-px">
                  <span className={`text-[11px] font-semibold ${sw.primary ? 'text-brand-700' : 'text-slate2-700'}`}>
                    {sw.n}{sw.primary && ' ★'}
                  </span>
                  <span className="text-[10px] font-mono text-slate2-400">{sw.hex}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ))}

      <Card>
        <div className="p-7">
          <Label>Uso semântico</Label>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate2-100">
                {['Token', 'Cor', 'Hex', 'Quando usar'].map((h) => (
                  <th key={h} className="text-left text-[11px] font-bold tracking-wider uppercase text-slate2-400 px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {semantic.map((s, i) => (
                <tr key={s.name} className={i < semantic.length - 1 ? 'border-b border-slate2-100' : ''}>
                  <td className="px-3 py-2.5 text-[13px] font-medium">{s.name}</td>
                  <td className="px-3 py-2.5"><span className={`inline-block w-3 h-3 rounded ${s.cls} align-middle`} /></td>
                  <td className="px-3 py-2.5 text-[13px] font-mono text-slate2-500">{s.hex}</td>
                  <td className="px-3 py-2.5 text-[13px] text-slate2-600">
                    {s.name === 'Sucesso' && 'Confirmações, conclusão de serviço, recibo de pagamento'}
                    {s.name === 'Aviso' && 'Estados pendentes, atenção sem bloqueio'}
                    {s.name === 'Erro' && 'Falhas, cancelamentos, ações destrutivas'}
                    {s.name === 'Info' && 'Estados primários, links, ações principais'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 03 — TIPOGRAFIA
// ---------------------------------------------------------------------------
const typeScale = [
  { lbl: 'Display Hero', spec: '48 / 1.1 / 800', cls: 'font-display text-5xl font-extrabold tracking-tight' },
  { lbl: 'Page title',   spec: '32 / 1.1 / 800', cls: 'font-display text-[32px] font-extrabold' },
  { lbl: 'Section title',spec: '24 / 1.2 / 700', cls: 'font-display text-2xl font-bold' },
  { lbl: 'Subtitle',     spec: '18 / 1.3 / 600', cls: 'font-display text-lg font-semibold' },
  { lbl: 'Body L',       spec: '16 / 1.5 / 400', cls: 'text-base' },
  { lbl: 'Body M',       spec: '14 / 1.55 / 400', cls: 'text-sm' },
  { lbl: 'Caption',      spec: '12 / 1.4 / 500',  cls: 'text-xs font-medium' },
  { lbl: 'Eyebrow',      spec: '11 / 700 / 0.15em / UPPER', cls: 'text-[11px] font-bold tracking-[0.15em] uppercase text-brand-600' },
]

function TypographySection() {
  return (
    <Section
      id="tipografia"
      eyebrow="01 — Fundação"
      title="Tipografia"
      sub="Plus Jakarta Sans (display, brand) para títulos e marca. DM Sans (body, UI) para texto corrido e interfaces. Escala de 8 níveis."
    >
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <div className="p-7">
            <p className="text-[13px] font-bold text-slate2-600 mb-1.5">Plus Jakarta Sans</p>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {['400', '500', '600', '700', '800'].map((w) => (
                <span key={w} className="text-[11px] bg-slate2-100 text-slate2-600 px-2 py-0.5 rounded">{w}</span>
              ))}
            </div>
            <p className="font-display font-extrabold text-3xl leading-tight">A serviço da sua missão.</p>
          </div>
        </Card>
        <Card>
          <div className="p-7">
            <p className="text-[13px] font-bold text-slate2-600 mb-1.5">DM Sans</p>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {['400', '500', '600'].map((w) => (
                <span key={w} className="text-[11px] bg-slate2-100 text-slate2-600 px-2 py-0.5 rounded">{w}</span>
              ))}
            </div>
            <p className="text-base leading-relaxed">
              Conectamos pessoas que precisam resolver algo com profissionais
              dispostos a cumprir essa missão — com transparência, segurança e respeito.
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-7">
          <Label>Escala — 8 níveis</Label>
          {typeScale.map((t) => (
            <div key={t.lbl} className="flex items-baseline gap-6 py-4 border-b border-slate2-100 last:border-0">
              <div className="w-36 flex-shrink-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate2-400">{t.lbl}</div>
                <div className="text-[11px] font-mono text-slate2-400 mt-0.5">{t.spec}</div>
              </div>
              <div className={t.cls}>
                {t.lbl === 'Eyebrow' ? 'Marketplace de serviços' : 'Cumprir missões, conectar pessoas.'}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 04 — BOTÕES
// ---------------------------------------------------------------------------
function ButtonsSection() {
  return (
    <Section
      id="botoes"
      eyebrow="02 — Componentes"
      title="Botões"
      sub="6 variantes × 3 tamanhos. Primary (azul) e Success (verde) são os hierárquicos principais; demais para contextos específicos."
    >
      <Card className="mb-4">
        <div className="p-7">
          <Label>Variantes</Label>
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="primary">Primary</Button>
            <Button variant="success">Success</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="p-7">
          <Label>Tamanhos (sm · md · lg)</Label>
          <div className="flex flex-wrap gap-3 items-center">
            <Button size="sm">Pequeno</Button>
            <Button size="md">Médio</Button>
            <Button size="lg">Grande</Button>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="p-7">
          <Label>Com ícone</Label>
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="primary"><Check className="w-4 h-4" /> Aprovar</Button>
            <Button variant="success"><CheckCircle2 className="w-4 h-4" /> Confirmar conclusão</Button>
            <Button variant="outline">Ver detalhes <ArrowRight className="w-4 h-4" /></Button>
            <Button variant="danger"><X className="w-4 h-4" /> Cancelar</Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-7">
          <Label>Estados — loading & disabled</Label>
          <div className="flex flex-wrap gap-3 items-center">
            <Button isLoading>Carregando</Button>
            <Button disabled>Desabilitado</Button>
            <Button variant="success" isLoading>Aprovando…</Button>
          </div>
        </div>
      </Card>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 05 — INPUTS
// ---------------------------------------------------------------------------
function InputsSection() {
  const [val, setVal] = useState('contato@missaocumprida.com.br')
  return (
    <Section
      id="inputs"
      eyebrow="02 — Componentes"
      title="Inputs"
      sub="4 estados: default · focused · error · disabled. Mantêm a mesma altura e raio (10px) para alinhamento consistente em formulários."
    >
      <Card>
        <div className="p-7 grid grid-cols-2 gap-5">
          <Input label="Default" placeholder="seu@email.com" />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate2-700">Focused</label>
            <div className="block w-full rounded-lg border-2 border-brand-500 px-3 py-2 text-sm bg-white shadow-[0_0_0_3px_rgba(59,130,246,0.15)]">
              {val}
            </div>
            <p className="text-xs text-slate2-400">Ativa quando o usuário foca o campo</p>
          </div>
          <Input label="Error" defaultValue="invalido" error="Formato de e-mail inválido" />
          <Input label="Disabled" defaultValue="bloqueado" disabled />
        </div>
      </Card>

      <Card className="mt-4">
        <div className="p-7">
          <Label>Com ícone à esquerda</Label>
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate2-400" />
            <input
              type="text"
              placeholder="Buscar serviço…"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate2-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </div>
      </Card>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 06 — BADGES
// ---------------------------------------------------------------------------
function BadgesSection() {
  return (
    <Section
      id="badges"
      eyebrow="02 — Componentes"
      title="Badges e Tags"
      sub="Pílulas compactas para indicar status. Texto + dot colorido reforçam a leitura rápida."
    >
      <Card className="mb-4">
        <div className="p-7">
          <Label>Variantes semânticas</Label>
          <div className="flex flex-wrap gap-2">
            <Badge variant="gray">Default</Badge>
            <Badge variant="blue">Info</Badge>
            <Badge variant="green">Success</Badge>
            <Badge variant="amber">Warning</Badge>
            <Badge variant="red">Danger</Badge>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-7">
          <Label>Aplicação — status do pedido</Label>
          <div className="flex flex-wrap gap-2">
            <Badge variant="gray">Aberto</Badge>
            <Badge variant="blue">Em proposta</Badge>
            <Badge variant="amber">Aguardando pagamento</Badge>
            <Badge variant="blue">Agendado</Badge>
            <Badge variant="green">Concluído</Badge>
            <Badge variant="red">Cancelado</Badge>
          </div>
        </div>
      </Card>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 07 — CARDS
// ---------------------------------------------------------------------------
function CardsSection() {
  return (
    <Section
      id="cards"
      eyebrow="02 — Componentes"
      title="Cards"
      sub="Container padrão para conteúdo segmentado. Raio 16px, borda 1px slate2-200, fundo branco. Hover sutil para itens clicáveis."
    >
      <div className="grid grid-cols-2 gap-4">
        {/* Service card */}
        <div className="bg-white border border-slate2-200 rounded-2xl p-4 transition-all cursor-pointer hover:border-brand-300 hover:shadow-brand-soft">
          <div className="text-3xl mb-3">🌿</div>
          <h3 className="font-semibold text-slate2-800 mb-1">Cortar Grama</h3>
          <p className="text-xs text-slate2-500">A partir de R$ 80,00</p>
          <p className="text-xs text-slate2-400 mt-0.5">~2h</p>
        </div>

        {/* Order card */}
        <div className="bg-white border border-slate2-200 rounded-2xl p-5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-lg">🌿</span>
            <Badge variant="blue">Cortar Grama</Badge>
          </div>
          <h3 className="font-semibold text-slate2-900 mb-1">Jardim de 80m² em Lajeado</h3>
          <p className="text-sm text-slate2-600 line-clamp-2 mb-3">
            Corte regular do gramado, recolhimento das aparas e ajuste das bordas.
          </p>
          <div className="flex items-center justify-between pt-3 border-t border-slate2-100">
            <div>
              <p className="text-xs text-slate2-500">Você recebe</p>
              <p className="font-bold text-brand-700">R$ 72,00</p>
            </div>
            <Button size="sm">Ver pedido →</Button>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 08 — ELEVAÇÃO
// ---------------------------------------------------------------------------
function ElevationSection() {
  const levels = [
    { name: 'elv-0', cls: 'border border-slate2-200', desc: 'Cards estáticos' },
    { name: 'elv-1', cls: 'shadow-elv-1',  desc: 'Lista hovers, inputs' },
    { name: 'elv-2', cls: 'shadow-elv-2',  desc: 'Dropdowns, popovers' },
    { name: 'elv-3', cls: 'shadow-elv-3',  desc: 'Modais, sheet' },
    { name: 'elv-4', cls: 'shadow-elv-4',  desc: 'Diálogos críticos' },
  ]
  return (
    <Section
      id="elevacao"
      eyebrow="02 — Componentes"
      title="Elevação"
      sub="5 níveis de sombra projetada para criar hierarquia. Cresce com a importância: cards rasos → modais elevados."
    >
      <Card>
        <div className="p-7 grid grid-cols-5 gap-6">
          {levels.map((l) => (
            <div key={l.name} className="flex flex-col items-center gap-3">
              <div className={`w-full h-20 bg-white rounded-xl flex items-center justify-center ${l.cls}`}>
                <span className="text-xs font-mono text-slate2-500">{l.name}</span>
              </div>
              <p className="text-[10px] text-slate2-500 text-center">{l.desc}</p>
            </div>
          ))}
        </div>
      </Card>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 09 — BORDER RADIUS
// ---------------------------------------------------------------------------
function RadiusSection() {
  const radii = [
    { name: 'sm', px: '6px',  cls: 'rounded-md' },
    { name: 'md', px: '8px',  cls: 'rounded-lg' },
    { name: 'lg', px: '12px', cls: 'rounded-xl' },
    { name: 'xl', px: '16px', cls: 'rounded-2xl' },
    { name: 'full', px: '999px', cls: 'rounded-full' },
  ]
  return (
    <Section
      id="raios"
      eyebrow="02 — Componentes"
      title="Border Radius"
      sub="Escala de raios. Usados em sequência crescente: chips → botões → cards → modais → avatares."
    >
      <Card>
        <div className="p-7 grid grid-cols-5 gap-4">
          {radii.map((r) => (
            <div key={r.name} className="flex flex-col items-center gap-2">
              <div className={`w-full h-16 bg-brand-700 ${r.cls} flex items-center justify-center text-white text-[13px] font-semibold`}>
                {r.name}
              </div>
              <span className="text-[10px] font-mono text-slate2-400">{r.px}</span>
            </div>
          ))}
        </div>
      </Card>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 10 — ESPAÇAMENTO
// ---------------------------------------------------------------------------
function SpacingSection() {
  const steps = [
    { tok: '1', px: 4 }, { tok: '2', px: 8 }, { tok: '3', px: 12 },
    { tok: '4', px: 16 }, { tok: '6', px: 24 }, { tok: '8', px: 32 },
    { tok: '12', px: 48 }, { tok: '16', px: 64 },
  ]
  return (
    <Section
      id="espacamento"
      eyebrow="02 — Componentes"
      title="Espaçamento"
      sub="Escala base 4. Use múltiplos para garantir ritmo vertical e horizontal previsível."
    >
      <Card>
        <div className="p-7 space-y-3">
          {steps.map((s) => (
            <div key={s.tok} className="flex items-center gap-4">
              <div className="w-12 text-[11px] font-mono text-slate2-400">{s.tok}</div>
              <div className="bg-brand-700 h-3 rounded" style={{ width: `${s.px}px` }} />
              <div className="text-xs text-slate2-500">{s.px}px</div>
            </div>
          ))}
        </div>
      </Card>
    </Section>
  )
}
