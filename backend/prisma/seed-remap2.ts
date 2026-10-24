import { PrismaClient } from '@prisma/client'
import { syncQuestionnaire } from './catalogSync'

/**
 * Remap 2.0 — Catálogo expandido (ver REMAP_2.0.md §3)
 * ------------------------------------------------------------------
 * 1. Cria 6 grupos novos e reordena os existentes (taxonomia de 17 grupos).
 * 2. Move categorias de grupo (slugs NUNCA mudam — pedidos antigos seguem válidos).
 * 3. Aposenta o grupo "Serviços Gerais" (is_active=false, sem deletar).
 * 4. Cria ~80 categorias novas com questionários, inspiradas em
 *    Thumbtack / TaskRabbit / GetNinjas / Craigslist.
 *
 * Idempotente: upsert por slug + questionários sincronizados por chave
 * estável (catalogSync.ts) — perguntas nunca são apagadas.
 */

type QField = {
  question: string
  field_type: string
  options?: string[]
  is_required?: boolean
  affects_price?: boolean
  price_modifier?: Record<string, number>
  help_text?: string
  placeholder?: string
}

type NewCategory = {
  group: string
  name: string
  slug: string
  icon: string
  description: string
  min: number
  max: number
  hours?: number
  questions: QField[]
}

// ── Taxonomia final: 17 grupos ativos ─────────────────────────────
const GRUPOS: Array<{ slug: string; name: string; icon: string; order: number }> = [
  { slug: 'para-sua-casa',       name: 'Para Sua Casa',          icon: '🏠', order: 1 },
  { slug: 'reformas-construcao', name: 'Reformas e Construção',  icon: '🧱', order: 2 },
  { slug: 'limpeza-domestico',   name: 'Limpeza e Doméstico',    icon: '🧺', order: 3 },
  { slug: 'assistencia-tecnica', name: 'Assistência Técnica',    icon: '🔌', order: 4 },
  { slug: 'mudancas-carretos',   name: 'Mudanças e Carretos',    icon: '🚚', order: 5 },
  { slug: 'para-seu-carro',      name: 'Para Seu Carro',         icon: '🚗', order: 6 },
  { slug: 'beleza-estetica',     name: 'Beleza e Estética',      icon: '💇', order: 7 },
  { slug: 'para-seu-pet',        name: 'Para Seu Pet',           icon: '🐾', order: 8 },
  { slug: 'tech-digital',        name: 'Tech e Digital',         icon: '💻', order: 9 },
  { slug: 'entregas-logistica',  name: 'Entregas e Tarefas',     icon: '📦', order: 10 },
  { slug: 'eventos-festas',      name: 'Eventos e Festas',       icon: '🎉', order: 11 },
  { slug: 'educacao-aulas',      name: 'Educação e Aulas',       icon: '📚', order: 12 },
  { slug: 'fitness-bem-estar',   name: 'Fitness e Bem-Estar',    icon: '🏋️', order: 13 },
  { slug: 'saude-em-casa',       name: 'Saúde e Cuidados',       icon: '🏥', order: 14 },
  { slug: 'freelancers-digitais',name: 'Freelancers Digitais',   icon: '🖥️', order: 15 },
  { slug: 'negocios-escritorio', name: 'Negócios e Escritório',  icon: '💼', order: 16 },
  { slug: 'moda-costura',        name: 'Moda e Costura',         icon: '🧵', order: 17 },
]

// ── Migração de categorias entre grupos (slug da categoria → slug do grupo novo)
const MOVIMENTOS: Record<string, string[]> = {
  'reformas-construcao': ['instalacao-piso', 'gesseiro-drywall', 'serralheria', 'impermeabilizacao', 'limpeza-telhado'],
  'limpeza-domestico':   ['limpeza-residencial', 'limpeza-piscina', 'limpeza-sofas', 'lavanderia'],
  'assistencia-tecnica': ['conserto-eletrodomesticos', 'conserto-computador'],
  'mudancas-carretos':   ['frete-transporte'],
  'para-sua-casa':       ['chaveiro', 'instalacao-cortinas', 'jardinagem-paisagismo'],
  'entregas-logistica':  ['motorista-particular'],
}

const CATALOGO: NewCategory[] = [
  // ════════════ 🧱 REFORMAS E CONSTRUÇÃO ════════════
  {
    group: 'reformas-construcao', name: 'Pedreiro / Alvenaria', slug: 'pedreiro-alvenaria', icon: '🧱',
    description: 'Muros, paredes, rebocos, contrapisos e pequenas obras', min: 150, max: 2000, hours: 8,
    questions: [
      { question: 'Qual o serviço de alvenaria?', field_type: 'SELECT', options: ['Construir muro', 'Levantar parede', 'Reboco/emboço', 'Contrapiso', 'Abrir/fechar vão de porta ou janela', 'Pequenos reparos', 'Outro'], affects_price: true, price_modifier: { 'Construir muro': 1.8, 'Levantar parede': 1.5, 'Reboco/emboço': 1.2, 'Contrapiso': 1.4, 'Abrir/fechar vão de porta ou janela': 1.3, 'Pequenos reparos': 0.7 }, is_required: true },
      { question: 'Tamanho aproximado da obra?', field_type: 'SELECT', options: ['Pequena (até 10m²)', 'Média (10-30m²)', 'Grande (30-80m²)', 'Muito grande (acima de 80m²)'], affects_price: true, price_modifier: { 'Pequena (até 10m²)': 1, 'Média (10-30m²)': 2, 'Grande (30-80m²)': 4, 'Muito grande (acima de 80m²)': 7 }, is_required: true },
      { question: 'O material já está comprado?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.3 }, is_required: true },
      { question: 'Foto do local da obra', field_type: 'PHOTO', is_required: true },
    ],
  },
  {
    group: 'reformas-construcao', name: 'Reforma de Banheiro', slug: 'reforma-banheiro', icon: '🚿',
    description: 'Reforma completa ou parcial de banheiros', min: 800, max: 8000, hours: 40,
    questions: [
      { question: 'Tipo de reforma?', field_type: 'RADIO', options: ['Troca de revestimentos', 'Troca de louças e metais', 'Reforma completa (piso ao teto)', 'Adaptação para acessibilidade'], affects_price: true, price_modifier: { 'Troca de revestimentos': 1, 'Troca de louças e metais': 0.6, 'Reforma completa (piso ao teto)': 2.5, 'Adaptação para acessibilidade': 1.5 }, is_required: true },
      { question: 'Tamanho do banheiro?', field_type: 'RADIO', options: ['Lavabo (até 2m²)', 'Padrão (2-5m²)', 'Grande (acima de 5m²)'], affects_price: true, price_modifier: { 'Lavabo (até 2m²)': 0.7, 'Padrão (2-5m²)': 1, 'Grande (acima de 5m²)': 1.5 }, is_required: true },
      { question: 'O material/revestimento já está comprado?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.25 }, is_required: true },
      { question: 'Foto atual do banheiro', field_type: 'PHOTO', is_required: true },
    ],
  },
  {
    group: 'reformas-construcao', name: 'Reforma de Cozinha', slug: 'reforma-cozinha', icon: '🍳',
    description: 'Reforma completa ou parcial de cozinhas e áreas gourmet', min: 1000, max: 12000, hours: 60,
    questions: [
      { question: 'O que será reformado?', field_type: 'SELECT', options: ['Revestimentos (piso/parede)', 'Bancadas e pia', 'Armários planejados', 'Parte hidráulica/elétrica', 'Reforma completa'], affects_price: true, price_modifier: { 'Revestimentos (piso/parede)': 1, 'Bancadas e pia': 0.8, 'Armários planejados': 1.5, 'Parte hidráulica/elétrica': 0.9, 'Reforma completa': 3 }, is_required: true },
      { question: 'Tamanho da cozinha?', field_type: 'RADIO', options: ['Compacta (até 5m²)', 'Média (5-12m²)', 'Grande (acima de 12m²)'], affects_price: true, price_modifier: { 'Compacta (até 5m²)': 0.8, 'Média (5-12m²)': 1, 'Grande (acima de 12m²)': 1.6 }, is_required: true },
      { question: 'Precisa de projeto (arquiteto/designer)?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.4, 'false': 1 }, is_required: true },
      { question: 'Foto atual da cozinha', field_type: 'PHOTO', is_required: true },
    ],
  },
  {
    group: 'reformas-construcao', name: 'Vidraçaria / Box e Espelhos', slug: 'vidracaria', icon: '🪞',
    description: 'Box de banheiro, espelhos, vidros temperados e janelas', min: 150, max: 1500, hours: 3,
    questions: [
      { question: 'Qual o serviço?', field_type: 'SELECT', options: ['Instalar box de banheiro', 'Trocar vidro de janela/porta', 'Instalar espelho', 'Fechamento de sacada', 'Guarda-corpo de vidro', 'Conserto de roldana/puxador'], affects_price: true, price_modifier: { 'Instalar box de banheiro': 1, 'Trocar vidro de janela/porta': 0.7, 'Instalar espelho': 0.6, 'Fechamento de sacada': 3, 'Guarda-corpo de vidro': 2.5, 'Conserto de roldana/puxador': 0.4 }, is_required: true },
      { question: 'Medidas aproximadas (largura x altura)', field_type: 'TEXT', is_required: true, placeholder: 'Ex: 1,20m x 1,90m' },
      { question: 'O vidro/material já está comprado?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.5 }, is_required: true },
      { question: 'Foto do local', field_type: 'PHOTO', is_required: true },
    ],
  },
  {
    group: 'reformas-construcao', name: 'Calhas e Rufos', slug: 'calhas-rufos', icon: '🌧️',
    description: 'Instalação, troca e limpeza de calhas, rufos e condutores', min: 150, max: 1200, hours: 4,
    questions: [
      { question: 'Tipo de serviço?', field_type: 'RADIO', options: ['Instalação nova', 'Troca de calhas antigas', 'Conserto de vazamento', 'Limpeza e desobstrução'], affects_price: true, price_modifier: { 'Instalação nova': 1.5, 'Troca de calhas antigas': 1.3, 'Conserto de vazamento': 0.8, 'Limpeza e desobstrução': 0.6 }, is_required: true },
      { question: 'Metragem aproximada de calha?', field_type: 'SELECT', options: ['Até 10m', '10-25m', '25-50m', 'Acima de 50m'], affects_price: true, price_modifier: { 'Até 10m': 1, '10-25m': 1.8, '25-50m': 3, 'Acima de 50m': 5 }, is_required: true },
      { question: 'Foto do telhado/calha', field_type: 'PHOTO', is_required: true },
    ],
  },
  {
    group: 'reformas-construcao', name: 'Construção e Reforma de Telhado', slug: 'reforma-telhado', icon: '🏗️',
    description: 'Estrutura, cobertura nova, troca de madeiramento e telhas', min: 300, max: 5000, hours: 24,
    questions: [
      { question: 'Tipo de serviço?', field_type: 'SELECT', options: ['Telhado novo (estrutura + telhas)', 'Troca de telhas', 'Troca de madeiramento', 'Conserto de goteiras', 'Instalação de forro'], affects_price: true, price_modifier: { 'Telhado novo (estrutura + telhas)': 3, 'Troca de telhas': 1.2, 'Troca de madeiramento': 2, 'Conserto de goteiras': 0.6, 'Instalação de forro': 1 }, is_required: true },
      { question: 'Área aproximada do telhado?', field_type: 'SELECT', options: ['Até 50m²', '50-100m²', '100-200m²', 'Acima de 200m²'], affects_price: true, price_modifier: { 'Até 50m²': 1, '50-100m²': 1.8, '100-200m²': 3, 'Acima de 200m²': 5 }, is_required: true },
      { question: 'O material já está comprado?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.35 }, is_required: true },
      { question: 'Foto do telhado atual', field_type: 'PHOTO', is_required: true },
    ],
  },
  {
    group: 'reformas-construcao', name: 'Instalação de Energia Solar', slug: 'energia-solar', icon: '☀️',
    description: 'Projeto, instalação e manutenção de painéis fotovoltaicos', min: 500, max: 5000, hours: 16,
    questions: [
      { question: 'Tipo de serviço?', field_type: 'RADIO', options: ['Orçamento de sistema completo', 'Instalação (kit já comprado)', 'Manutenção/limpeza de painéis', 'Ampliação de sistema existente'], affects_price: true, price_modifier: { 'Orçamento de sistema completo': 2, 'Instalação (kit já comprado)': 1, 'Manutenção/limpeza de painéis': 0.4, 'Ampliação de sistema existente': 0.8 }, is_required: true },
      { question: 'Valor médio da conta de luz?', field_type: 'SELECT', options: ['Até R$ 200', 'R$ 200-500', 'R$ 500-1.000', 'Acima de R$ 1.000'], affects_price: true, price_modifier: { 'Até R$ 200': 1, 'R$ 200-500': 1.5, 'R$ 500-1.000': 2.2, 'Acima de R$ 1.000': 3 }, is_required: true },
      { question: 'Tipo de imóvel?', field_type: 'RADIO', options: ['Casa', 'Comércio', 'Área rural', 'Prédio/condomínio'], affects_price: false, is_required: true },
      { question: 'Foto do telhado/local de instalação', field_type: 'PHOTO', is_required: false },
    ],
  },
  {
    group: 'reformas-construcao', name: 'Aquecedor a Gás / Solar', slug: 'aquecedor-agua', icon: '🔥',
    description: 'Instalação e manutenção de aquecedores de água a gás e solares', min: 200, max: 1500, hours: 4,
    questions: [
      { question: 'Tipo de serviço?', field_type: 'RADIO', options: ['Instalação de aquecedor a gás', 'Instalação de aquecedor solar (boiler)', 'Manutenção/conserto', 'Troca de aparelho antigo'], affects_price: true, price_modifier: { 'Instalação de aquecedor a gás': 1, 'Instalação de aquecedor solar (boiler)': 2, 'Manutenção/conserto': 0.6, 'Troca de aparelho antigo': 1.2 }, is_required: true },
      { question: 'O aparelho já está comprado?', field_type: 'BOOLEAN', is_required: true },
      { question: 'Quantos pontos de água quente (chuveiros/torneiras)?', field_type: 'SELECT', options: ['1 ponto', '2-3 pontos', '4 ou mais'], affects_price: true, price_modifier: { '1 ponto': 1, '2-3 pontos': 1.5, '4 ou mais': 2 }, is_required: true },
      { question: 'Foto do local de instalação', field_type: 'PHOTO', is_required: false },
    ],
  },
  {
    group: 'reformas-construcao', name: 'Demolição e Retirada de Entulho', slug: 'demolicao-entulho', icon: '🗑️',
    description: 'Demolição de paredes/estruturas e remoção de entulho com caçamba', min: 200, max: 1500, hours: 8,
    questions: [
      { question: 'Qual o serviço?', field_type: 'RADIO', options: ['Demolir parede/estrutura', 'Somente retirada de entulho', 'Demolição + retirada', 'Remoção de móveis e itens grandes'], affects_price: true, price_modifier: { 'Demolir parede/estrutura': 1, 'Somente retirada de entulho': 0.7, 'Demolição + retirada': 1.6, 'Remoção de móveis e itens grandes': 0.8 }, is_required: true },
      { question: 'Volume estimado de entulho?', field_type: 'SELECT', options: ['Até 1m³ (poucos sacos)', '1-4m³ (meia caçamba)', '4-8m³ (1 caçamba)', 'Mais de 8m³'], affects_price: true, price_modifier: { 'Até 1m³ (poucos sacos)': 1, '1-4m³ (meia caçamba)': 1.6, '4-8m³ (1 caçamba)': 2.4, 'Mais de 8m³': 4 }, is_required: true },
      { question: 'Foto do local/entulho', field_type: 'PHOTO', is_required: true },
    ],
  },
  {
    group: 'reformas-construcao', name: 'Arquiteto / Projeto e Laudo', slug: 'arquiteto-projeto', icon: '📐',
    description: 'Projetos arquitetônicos, design de interiores e laudos técnicos', min: 300, max: 5000, hours: 20,
    questions: [
      { question: 'O que você precisa?', field_type: 'SELECT', options: ['Projeto arquitetônico completo', 'Projeto de interiores', 'Projeto 3D de um ambiente', 'Laudo técnico / vistoria', 'Regularização de obra (prefeitura)', 'Consultoria pontual'], affects_price: true, price_modifier: { 'Projeto arquitetônico completo': 3, 'Projeto de interiores': 2, 'Projeto 3D de um ambiente': 1, 'Laudo técnico / vistoria': 0.8, 'Regularização de obra (prefeitura)': 1.5, 'Consultoria pontual': 0.5 }, is_required: true },
      { question: 'Área aproximada do imóvel/ambiente?', field_type: 'SELECT', options: ['Até 50m²', '50-120m²', '120-300m²', 'Acima de 300m²'], affects_price: true, price_modifier: { 'Até 50m²': 1, '50-120m²': 1.6, '120-300m²': 2.5, 'Acima de 300m²': 4 }, is_required: true },
      { question: 'Descreva o que imagina para o projeto', field_type: 'TEXTAREA', is_required: true },
    ],
  },

  // ════════════ 🧺 LIMPEZA E DOMÉSTICO ════════════
  {
    group: 'limpeza-domestico', name: 'Diarista (recorrente)', slug: 'diarista', icon: '🧹',
    description: 'Diarista fixa semanal, quinzenal ou avulsa', min: 120, max: 350, hours: 6,
    questions: [
      { question: 'Tamanho do imóvel?', field_type: 'SELECT', options: ['Kitnet/Studio', '1 dormitório', '2 dormitórios', '3 dormitórios', '4+ dormitórios'], affects_price: true, price_modifier: { 'Kitnet/Studio': 0.7, '1 dormitório': 1, '2 dormitórios': 1.3, '3 dormitórios': 1.6, '4+ dormitórios': 2 }, is_required: true },
      { question: 'Frequência?', field_type: 'RADIO', options: ['1x por semana', '2x por semana', 'Quinzenal', 'Avulsa (uma vez)'], affects_price: true, price_modifier: { '1x por semana': 0.9, '2x por semana': 0.85, 'Quinzenal': 0.95, 'Avulsa (uma vez)': 1 }, is_required: true },
      { question: 'Inclui passar roupa?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
      { question: 'Tem pets em casa?', field_type: 'BOOLEAN', is_required: true },
      { question: 'Os produtos de limpeza serão fornecidos pela diarista?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.1, 'false': 1 }, is_required: true },
    ],
  },
  {
    group: 'limpeza-domestico', name: 'Passadeira de Roupas', slug: 'passadeira', icon: '👔',
    description: 'Passar roupas em domicílio ou com retirada e entrega', min: 80, max: 250, hours: 3,
    questions: [
      { question: 'Volume de roupas?', field_type: 'SELECT', options: ['1 cesto pequeno (até 20 peças)', '2 cestos (20-50 peças)', '3+ cestos (acima de 50 peças)'], affects_price: true, price_modifier: { '1 cesto pequeno (até 20 peças)': 1, '2 cestos (20-50 peças)': 1.8, '3+ cestos (acima de 50 peças)': 3 }, is_required: true },
      { question: 'Onde será o serviço?', field_type: 'RADIO', options: ['Na minha casa', 'Retirada e entrega (na casa da profissional)'], affects_price: true, price_modifier: { 'Na minha casa': 1, 'Retirada e entrega (na casa da profissional)': 1.2 }, is_required: true },
      { question: 'Tem peças delicadas (social, seda, linho)?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
    ],
  },
  {
    group: 'limpeza-domestico', name: 'Cozinheira Semanal / Marmitas', slug: 'cozinheira-marmitas', icon: '🍲',
    description: 'Cozinheira para o dia a dia e marmitas da semana', min: 100, max: 500, hours: 5,
    questions: [
      { question: 'Tipo de serviço?', field_type: 'RADIO', options: ['Cozinhar na minha casa (dia único)', 'Cozinheira fixa (dias por semana)', 'Marmitas da semana (entrega)'], affects_price: true, price_modifier: { 'Cozinhar na minha casa (dia único)': 1, 'Cozinheira fixa (dias por semana)': 0.9, 'Marmitas da semana (entrega)': 1.2 }, is_required: true },
      { question: 'Para quantas pessoas?', field_type: 'SELECT', options: ['1-2 pessoas', '3-4 pessoas', '5-6 pessoas', 'Mais de 6'], affects_price: true, price_modifier: { '1-2 pessoas': 1, '3-4 pessoas': 1.4, '5-6 pessoas': 1.8, 'Mais de 6': 2.4 }, is_required: true },
      { question: 'Alguma restrição alimentar?', field_type: 'SELECT', options: ['Nenhuma', 'Vegetariana/vegana', 'Low carb / fit', 'Sem glúten/lactose', 'Outra (descrever no chat)'], affects_price: false, is_required: true },
      { question: 'Os ingredientes serão fornecidos pela cozinheira?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.4, 'false': 1 }, is_required: true },
    ],
  },
  {
    group: 'limpeza-domestico', name: "Limpeza de Caixa d'Água", slug: 'limpeza-caixa-dagua', icon: '💧',
    description: 'Limpeza e higienização de caixas d\'água e cisternas', min: 150, max: 500, hours: 3,
    questions: [
      { question: 'Capacidade da caixa?', field_type: 'SELECT', options: ['500L', '1.000L', '2.000L', 'Acima de 2.000L / cisterna'], affects_price: true, price_modifier: { '500L': 1, '1.000L': 1.3, '2.000L': 1.7, 'Acima de 2.000L / cisterna': 2.5 }, is_required: true },
      { question: 'Local de acesso à caixa?', field_type: 'RADIO', options: ['Fácil (laje baixa/suporte)', 'Telhado (precisa escada)', 'Difícil (altura/espaço apertado)'], affects_price: true, price_modifier: { 'Fácil (laje baixa/suporte)': 1, 'Telhado (precisa escada)': 1.2, 'Difícil (altura/espaço apertado)': 1.5 }, is_required: true },
      { question: 'Quando foi a última limpeza?', field_type: 'RADIO', options: ['Menos de 1 ano', '1-2 anos', 'Mais de 2 anos', 'Nunca / não sei'], affects_price: false, is_required: true },
    ],
  },
  {
    group: 'limpeza-domestico', name: 'Limpeza de Vidros e Fachadas', slug: 'limpeza-vidros-fachadas', icon: '🪟',
    description: 'Limpeza de vidraças, janelas, fachadas e esquadrias', min: 150, max: 1500, hours: 5,
    questions: [
      { question: 'O que será limpo?', field_type: 'SELECT', options: ['Janelas de casa/apartamento', 'Fachada de loja/comércio', 'Fachada de prédio (altura)', 'Portas e box de vidro'], affects_price: true, price_modifier: { 'Janelas de casa/apartamento': 1, 'Fachada de loja/comércio': 1.5, 'Fachada de prédio (altura)': 4, 'Portas e box de vidro': 0.7 }, is_required: true },
      { question: 'Área aproximada de vidro?', field_type: 'SELECT', options: ['Até 10m²', '10-30m²', '30-80m²', 'Acima de 80m²'], affects_price: true, price_modifier: { 'Até 10m²': 1, '10-30m²': 1.6, '30-80m²': 2.5, 'Acima de 80m²': 4 }, is_required: true },
      { question: 'Precisa de trabalho em altura (acima do 2º andar)?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.8, 'false': 1 }, is_required: true },
      { question: 'Foto do local', field_type: 'PHOTO', is_required: false },
    ],
  },
  {
    group: 'limpeza-domestico', name: 'Limpeza de Tapetes e Cortinas', slug: 'limpeza-tapetes-cortinas', icon: '🧼',
    description: 'Higienização de tapetes, carpetes, cortinas e persianas', min: 100, max: 500, hours: 3,
    questions: [
      { question: 'O que será higienizado?', field_type: 'SELECT', options: ['Tapete(s)', 'Carpete (cômodo)', 'Cortinas', 'Persianas', 'Vários itens'], affects_price: true, price_modifier: { 'Tapete(s)': 1, 'Carpete (cômodo)': 1.5, 'Cortinas': 1.2, 'Persianas': 1.1, 'Vários itens': 2 }, is_required: true },
      { question: 'Quantidade/tamanho?', field_type: 'SELECT', options: ['1 peça pequena', '1 peça grande', '2-3 peças', '4 ou mais peças'], affects_price: true, price_modifier: { '1 peça pequena': 1, '1 peça grande': 1.4, '2-3 peças': 2, '4 ou mais peças': 3 }, is_required: true },
      { question: 'Tem manchas ou odor (pet, mofo)?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.3, 'false': 1 }, is_required: true },
      { question: 'Foto do item', field_type: 'PHOTO', is_required: false },
    ],
  },
  {
    group: 'limpeza-domestico', name: 'Caseiro / Zelador', slug: 'caseiro-zelador', icon: '🏡',
    description: 'Cuidados com sítios, chácaras e manutenção de propriedades', min: 150, max: 500, hours: 8,
    questions: [
      { question: 'Tipo de propriedade?', field_type: 'RADIO', options: ['Sítio/chácara', 'Casa de praia/campo', 'Terreno', 'Condomínio/prédio pequeno'], affects_price: true, price_modifier: { 'Sítio/chácara': 1.3, 'Casa de praia/campo': 1, 'Terreno': 0.7, 'Condomínio/prédio pequeno': 1.2 }, is_required: true },
      { question: 'Frequência?', field_type: 'RADIO', options: ['Visita única', 'Semanal', 'Quinzenal', 'Morar no local (avaliar)'], affects_price: true, price_modifier: { 'Visita única': 1, 'Semanal': 0.85, 'Quinzenal': 0.9, 'Morar no local (avaliar)': 3 }, is_required: true },
      { question: 'Quais tarefas? (grama, piscina, animais, vigilância...)', field_type: 'TEXTAREA', is_required: true },
    ],
  },

  // ════════════ 🔌 ASSISTÊNCIA TÉCNICA ════════════
  {
    group: 'assistencia-tecnica', name: 'Conserto de Celular / Tablet', slug: 'conserto-celular', icon: '📱',
    description: 'Troca de tela, bateria, conector e reparos em geral', min: 80, max: 600, hours: 1,
    questions: [
      { question: 'Qual o problema?', field_type: 'SELECT', options: ['Tela quebrada/trincada', 'Bateria não segura carga', 'Não liga', 'Conector de carga', 'Molhou/caiu na água', 'Câmera ou alto-falante', 'Outro'], affects_price: true, price_modifier: { 'Tela quebrada/trincada': 1.5, 'Bateria não segura carga': 1, 'Não liga': 1.3, 'Conector de carga': 0.8, 'Molhou/caiu na água': 1.6, 'Câmera ou alto-falante': 1 }, is_required: true },
      { question: 'Marca e modelo do aparelho', field_type: 'TEXT', is_required: true, placeholder: 'Ex: iPhone 13 / Samsung A54' },
      { question: 'Atendimento preferido?', field_type: 'RADIO', options: ['Técnico vem até mim', 'Levo até o técnico', 'Retirada e entrega'], affects_price: true, price_modifier: { 'Técnico vem até mim': 1.2, 'Levo até o técnico': 1, 'Retirada e entrega': 1.15 }, is_required: true },
      { question: 'Foto do aparelho/dano', field_type: 'PHOTO', is_required: false },
    ],
  },
  {
    group: 'assistencia-tecnica', name: 'Conserto de Geladeira / Freezer', slug: 'conserto-geladeira', icon: '🧊',
    description: 'Reparo de geladeiras, freezers e frigobares', min: 120, max: 800, hours: 2,
    questions: [
      { question: 'Qual o problema?', field_type: 'SELECT', options: ['Não gela', 'Gela demais/congela tudo', 'Fazendo barulho', 'Vazando água', 'Não liga', 'Porta não veda', 'Outro'], affects_price: true, price_modifier: { 'Não gela': 1.3, 'Não liga': 1.4, 'Porta não veda': 0.7, 'Vazando água': 0.9 }, is_required: true },
      { question: 'Marca e modelo', field_type: 'TEXT', is_required: true, placeholder: 'Ex: Brastemp Frost Free 375L' },
      { question: 'Idade aproximada do aparelho?', field_type: 'RADIO', options: ['Até 2 anos', '2-5 anos', '5-10 anos', 'Mais de 10 anos'], affects_price: false, is_required: true },
      { question: 'Foto do aparelho / etiqueta', field_type: 'PHOTO', is_required: true },
    ],
  },
  {
    group: 'assistencia-tecnica', name: 'Conserto de Máquina de Lavar', slug: 'conserto-maquina-lavar', icon: '🌀',
    description: 'Reparo de lavadoras, lava e seca e tanquinhos', min: 120, max: 700, hours: 2,
    questions: [
      { question: 'Qual o problema?', field_type: 'SELECT', options: ['Não liga', 'Não centrifuga', 'Não enche/não solta água', 'Vazando água', 'Barulho forte ao bater/centrifugar', 'Não esquenta (lava e seca)', 'Outro'], affects_price: true, price_modifier: { 'Não liga': 1.3, 'Não centrifuga': 1.2, 'Vazando água': 1, 'Barulho forte ao bater/centrifugar': 1.1 }, is_required: true },
      { question: 'Tipo de máquina?', field_type: 'RADIO', options: ['Abertura superior', 'Front load (abertura frontal)', 'Lava e seca', 'Tanquinho'], affects_price: true, price_modifier: { 'Abertura superior': 1, 'Front load (abertura frontal)': 1.3, 'Lava e seca': 1.5, 'Tanquinho': 0.7 }, is_required: true },
      { question: 'Marca e modelo', field_type: 'TEXT', is_required: true, placeholder: 'Ex: Electrolux 12kg' },
      { question: 'Foto do aparelho', field_type: 'PHOTO', is_required: false },
    ],
  },
  {
    group: 'assistencia-tecnica', name: 'Conserto de Fogão / Cooktop', slug: 'conserto-fogao', icon: '🔥',
    description: 'Reparo de fogões, cooktops e fornos a gás ou elétricos', min: 80, max: 500, hours: 2,
    questions: [
      { question: 'Qual o problema?', field_type: 'SELECT', options: ['Boca não acende', 'Acendimento automático falhou', 'Forno não funciona', 'Cheiro de gás / vazamento', 'Instalação/conversão de gás', 'Outro'], affects_price: true, price_modifier: { 'Boca não acende': 0.8, 'Forno não funciona': 1.2, 'Cheiro de gás / vazamento': 1.4, 'Instalação/conversão de gás': 1 }, is_required: true },
      { question: 'Tipo?', field_type: 'RADIO', options: ['Fogão a gás', 'Cooktop a gás', 'Cooktop por indução/elétrico', 'Forno embutido'], affects_price: true, price_modifier: { 'Fogão a gás': 1, 'Cooktop a gás': 1.1, 'Cooktop por indução/elétrico': 1.4, 'Forno embutido': 1.3 }, is_required: true },
      { question: 'Marca e modelo', field_type: 'TEXT', is_required: false, placeholder: 'Ex: Consul 4 bocas' },
    ],
  },
  {
    group: 'assistencia-tecnica', name: 'Conserto de Micro-ondas', slug: 'conserto-microondas', icon: '⚡',
    description: 'Reparo de micro-ondas e fornos elétricos de bancada', min: 80, max: 400, hours: 1,
    questions: [
      { question: 'Qual o problema?', field_type: 'SELECT', options: ['Não esquenta', 'Não liga', 'Prato não gira', 'Faíscas internas', 'Painel/teclas não respondem', 'Outro'], affects_price: true, price_modifier: { 'Não esquenta': 1.2, 'Não liga': 1.1, 'Prato não gira': 0.7, 'Faíscas internas': 1.3 }, is_required: true },
      { question: 'Marca e modelo', field_type: 'TEXT', is_required: false, placeholder: 'Ex: Panasonic 32L' },
      { question: 'Atendimento preferido?', field_type: 'RADIO', options: ['Técnico vem até mim', 'Levo até o técnico', 'Retirada e entrega'], affects_price: true, price_modifier: { 'Técnico vem até mim': 1.2, 'Levo até o técnico': 1, 'Retirada e entrega': 1.15 }, is_required: true },
    ],
  },
  {
    group: 'assistencia-tecnica', name: 'Conserto de TV', slug: 'conserto-tv', icon: '📺',
    description: 'Reparo de TVs LED, OLED e Smart TVs', min: 100, max: 800, hours: 2,
    questions: [
      { question: 'Qual o problema?', field_type: 'SELECT', options: ['Tela escura (com som)', 'Não liga', 'Linhas/manchas na tela', 'Tela quebrada', 'Sem som', 'Não conecta no Wi-Fi/apps', 'Outro'], affects_price: true, price_modifier: { 'Tela escura (com som)': 1.2, 'Não liga': 1.1, 'Tela quebrada': 2, 'Não conecta no Wi-Fi/apps': 0.5 }, is_required: true },
      { question: 'Tamanho da TV?', field_type: 'SELECT', options: ['Até 32"', '40-50"', '55-65"', 'Acima de 65"'], affects_price: true, price_modifier: { 'Até 32"': 1, '40-50"': 1.2, '55-65"': 1.5, 'Acima de 65"': 1.8 }, is_required: true },
      { question: 'Marca e modelo', field_type: 'TEXT', is_required: true, placeholder: 'Ex: LG 55UN7100' },
      { question: 'Foto da TV ligada (mostrando o problema)', field_type: 'PHOTO', is_required: false },
    ],
  },
  {
    group: 'assistencia-tecnica', name: 'Conserto de Videogame', slug: 'conserto-videogame', icon: '🎮',
    description: 'Reparo de consoles e controles (PlayStation, Xbox, Nintendo)', min: 100, max: 500, hours: 2,
    questions: [
      { question: 'Qual aparelho?', field_type: 'SELECT', options: ['PlayStation 4/5', 'Xbox One/Series', 'Nintendo Switch', 'Console retrô', 'Controle (drift, botões)'], affects_price: true, price_modifier: { 'PlayStation 4/5': 1.2, 'Xbox One/Series': 1.2, 'Nintendo Switch': 1.1, 'Console retrô': 0.9, 'Controle (drift, botões)': 0.5 }, is_required: true },
      { question: 'Qual o problema?', field_type: 'SELECT', options: ['Não liga', 'Superaquecendo/barulho', 'Não lê disco/cartucho', 'Sem imagem (HDMI)', 'Controle com defeito', 'Limpeza preventiva'], affects_price: true, price_modifier: { 'Não liga': 1.4, 'Sem imagem (HDMI)': 1.3, 'Limpeza preventiva': 0.6 }, is_required: true },
      { question: 'Descreva o que acontece', field_type: 'TEXTAREA', is_required: false },
    ],
  },
  {
    group: 'assistencia-tecnica', name: 'Conserto de Impressora', slug: 'conserto-impressora', icon: '🖨️',
    description: 'Reparo e manutenção de impressoras e multifuncionais', min: 80, max: 400, hours: 1,
    questions: [
      { question: 'Qual o problema?', field_type: 'SELECT', options: ['Não imprime', 'Puxando papel errado/atolando', 'Impressão falhada/riscada', 'Não conecta (Wi-Fi/USB)', 'Limpeza de cabeçote', 'Outro'], affects_price: true, price_modifier: { 'Não imprime': 1.1, 'Impressão falhada/riscada': 1, 'Não conecta (Wi-Fi/USB)': 0.7, 'Limpeza de cabeçote': 0.8 }, is_required: true },
      { question: 'Tipo de impressora?', field_type: 'RADIO', options: ['Jato de tinta', 'Tanque de tinta (EcoTank)', 'Laser', 'Multifuncional'], affects_price: false, is_required: true },
      { question: 'Marca e modelo', field_type: 'TEXT', is_required: true, placeholder: 'Ex: Epson L3250' },
    ],
  },
  {
    group: 'assistencia-tecnica', name: 'Eletroportáteis (airfryer, cafeteira...)', slug: 'conserto-eletroportateis', icon: '☕',
    description: 'Reparo de airfryers, cafeteiras, liquidificadores e similares', min: 60, max: 300, hours: 1,
    questions: [
      { question: 'Qual aparelho?', field_type: 'SELECT', options: ['Airfryer', 'Cafeteira/expresso', 'Liquidificador/mixer', 'Aspirador de pó', 'Ventilador', 'Ferro de passar', 'Outro'], affects_price: true, price_modifier: { 'Airfryer': 1.1, 'Cafeteira/expresso': 1.2, 'Aspirador de pó': 1.1, 'Ventilador': 0.8, 'Ferro de passar': 0.7 }, is_required: true },
      { question: 'Qual o problema?', field_type: 'TEXTAREA', is_required: true, placeholder: 'Ex: não liga, não esquenta, faz barulho...' },
      { question: 'Marca e modelo', field_type: 'TEXT', is_required: false },
    ],
  },

  // ════════════ 🚚 MUDANÇAS E CARRETOS ════════════
  {
    group: 'mudancas-carretos', name: 'Mudança Completa', slug: 'mudanca-completa', icon: '🚚',
    description: 'Mudança residencial ou comercial com caminhão e equipe', min: 300, max: 3000, hours: 8,
    questions: [
      { question: 'Tamanho da mudança?', field_type: 'SELECT', options: ['Kitnet/Studio', 'Apartamento 1-2 dorms', 'Casa/apto 3+ dorms', 'Escritório/comércio'], affects_price: true, price_modifier: { 'Kitnet/Studio': 1, 'Apartamento 1-2 dorms': 1.6, 'Casa/apto 3+ dorms': 2.5, 'Escritório/comércio': 2.2 }, is_required: true },
      { question: 'Distância entre origem e destino?', field_type: 'SELECT', options: ['Mesma cidade (até 20km)', '20-100km', '100-300km', 'Acima de 300km'], affects_price: true, price_modifier: { 'Mesma cidade (até 20km)': 1, '20-100km': 1.6, '100-300km': 2.5, 'Acima de 300km': 4 }, is_required: true },
      { question: 'Tem escada ou restrição de acesso (origem ou destino)?', field_type: 'RADIO', options: ['Térreo/elevador nos dois', 'Escada em um dos lados', 'Escada nos dois lados'], affects_price: true, price_modifier: { 'Térreo/elevador nos dois': 1, 'Escada em um dos lados': 1.2, 'Escada nos dois lados': 1.4 }, is_required: true },
      { question: 'Precisa de desmontagem e montagem de móveis?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.3, 'false': 1 }, is_required: true },
      { question: 'Precisa de embalagem (caixas, plástico bolha)?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.25, 'false': 1 }, is_required: true },
    ],
  },
  {
    group: 'mudancas-carretos', name: 'Carreto / Frete Pequeno', slug: 'carreto', icon: '🛻',
    description: 'Transporte rápido de poucos itens e móveis avulsos', min: 80, max: 500, hours: 2,
    questions: [
      { question: 'O que será transportado?', field_type: 'SELECT', options: ['Poucos itens (caixas)', '1 móvel grande', 'Vários móveis', 'Eletrodoméstico grande'], affects_price: true, price_modifier: { 'Poucos itens (caixas)': 1, '1 móvel grande': 1.3, 'Vários móveis': 2, 'Eletrodoméstico grande': 1.5 }, is_required: true },
      { question: 'Distância aproximada?', field_type: 'SELECT', options: ['Até 5km', '5-15km', '15-40km', 'Acima de 40km'], affects_price: true, price_modifier: { 'Até 5km': 1, '5-15km': 1.4, '15-40km': 2, 'Acima de 40km': 3 }, is_required: true },
      { question: 'Tem escada/elevador na origem ou destino?', field_type: 'RADIO', options: ['Térreo dos dois lados', 'Escada (até 2 andares)', 'Escada (3+ andares)', 'Elevador'], affects_price: true, price_modifier: { 'Térreo dos dois lados': 1, 'Escada (até 2 andares)': 1.3, 'Escada (3+ andares)': 1.6, 'Elevador': 1.1 }, is_required: true },
      { question: 'Precisa de ajudante extra?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.4, 'false': 1 }, is_required: true },
    ],
  },
  {
    group: 'mudancas-carretos', name: 'Ajudante de Carga e Descarga', slug: 'ajudante-carga-descarga', icon: '💪',
    description: 'Ajudantes para carregar e descarregar (você já tem o veículo)', min: 80, max: 300, hours: 3,
    questions: [
      { question: 'Quantos ajudantes?', field_type: 'RADIO', options: ['1 ajudante', '2 ajudantes', '3 ou mais'], affects_price: true, price_modifier: { '1 ajudante': 1, '2 ajudantes': 1.9, '3 ou mais': 2.8 }, is_required: true },
      { question: 'Duração estimada?', field_type: 'RADIO', options: ['Até 2 horas', '2-4 horas', 'Diária (até 8h)'], affects_price: true, price_modifier: { 'Até 2 horas': 1, '2-4 horas': 1.7, 'Diária (até 8h)': 2.8 }, is_required: true },
      { question: 'Tem itens muito pesados (piano, cofre, mármore)?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.5, 'false': 1 }, is_required: true },
    ],
  },
  {
    group: 'mudancas-carretos', name: 'Embalagem para Mudança', slug: 'embalagem-mudanca', icon: '📦',
    description: 'Embalar louças, roupas e objetos com material incluso ou não', min: 100, max: 600, hours: 4,
    questions: [
      { question: 'Tamanho do imóvel a embalar?', field_type: 'SELECT', options: ['Kitnet/Studio', '1-2 dormitórios', '3+ dormitórios'], affects_price: true, price_modifier: { 'Kitnet/Studio': 1, '1-2 dormitórios': 1.7, '3+ dormitórios': 2.6 }, is_required: true },
      { question: 'O material de embalagem será fornecido pelo profissional?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.4, 'false': 1 }, is_required: true },
      { question: 'Tem muitos itens frágeis (louças, quadros, vidros)?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.25, 'false': 1 }, is_required: true },
    ],
  },
  {
    group: 'mudancas-carretos', name: 'Içamento de Móveis', slug: 'icamento-moveis', icon: '🪟',
    description: 'Içamento de sofás, camas e eletrodomésticos pela janela/sacada', min: 300, max: 2000, hours: 3,
    questions: [
      { question: 'O que será içado?', field_type: 'SELECT', options: ['Sofá', 'Cama/colchão', 'Geladeira', 'Armário/guarda-roupa', 'Outro item grande'], affects_price: true, price_modifier: { 'Sofá': 1, 'Geladeira': 1.3, 'Armário/guarda-roupa': 1.4 }, is_required: true },
      { question: 'Para qual andar?', field_type: 'SELECT', options: ['1º-2º andar', '3º-5º andar', '6º-10º andar', 'Acima do 10º'], affects_price: true, price_modifier: { '1º-2º andar': 1, '3º-5º andar': 1.5, '6º-10º andar': 2.2, 'Acima do 10º': 3 }, is_required: true },
      { question: 'Foto da fachada/janela e do móvel', field_type: 'PHOTO', is_required: true },
    ],
  },

  // ════════════ 🏠 PARA SUA CASA (reforço) ════════════
  {
    group: 'para-sua-casa', name: 'Automação Residencial / Alexa', slug: 'automacao-residencial', icon: '🏠',
    description: 'Casa inteligente: Alexa, lâmpadas, fechaduras e sensores', min: 150, max: 1000, hours: 3,
    questions: [
      { question: 'O que deseja automatizar?', field_type: 'SELECT', options: ['Assistente de voz (Alexa/Google)', 'Iluminação inteligente', 'Fechadura digital', 'Câmeras e sensores', 'Cortinas automatizadas', 'Projeto completo'], affects_price: true, price_modifier: { 'Assistente de voz (Alexa/Google)': 0.7, 'Iluminação inteligente': 1, 'Fechadura digital': 1.2, 'Cortinas automatizadas': 1.5, 'Projeto completo': 3 }, is_required: true },
      { question: 'Os equipamentos já estão comprados?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.3 }, is_required: true },
      { question: 'Quantos cômodos?', field_type: 'SELECT', options: ['1 cômodo', '2-3 cômodos', 'Casa toda'], affects_price: true, price_modifier: { '1 cômodo': 1, '2-3 cômodos': 1.6, 'Casa toda': 2.5 }, is_required: true },
    ],
  },
  {
    group: 'para-sua-casa', name: 'Papel de Parede / Adesivos', slug: 'papel-de-parede', icon: '🖼️',
    description: 'Aplicação de papel de parede, adesivos e painéis decorativos', min: 150, max: 1000, hours: 4,
    questions: [
      { question: 'Quantas paredes?', field_type: 'RADIO', options: ['1 parede', '2-3 paredes', 'Cômodo inteiro', 'Mais de um cômodo'], affects_price: true, price_modifier: { '1 parede': 1, '2-3 paredes': 1.8, 'Cômodo inteiro': 2.5, 'Mais de um cômodo': 4 }, is_required: true },
      { question: 'O papel/adesivo já está comprado?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.4 }, is_required: true },
      { question: 'A parede precisa de preparo (lixar, massa corrida)?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.3, 'false': 1 }, is_required: true },
      { question: 'Foto da parede', field_type: 'PHOTO', is_required: true },
    ],
  },
  {
    group: 'para-sua-casa', name: 'Redes de Proteção', slug: 'redes-protecao', icon: '🥅',
    description: 'Instalação de telas de proteção em janelas, sacadas e piscinas', min: 150, max: 800, hours: 3,
    questions: [
      { question: 'Onde será instalada?', field_type: 'SELECT', options: ['Janelas', 'Sacada/varanda', 'Piscina', 'Escada', 'Quadra esportiva'], affects_price: true, price_modifier: { 'Janelas': 1, 'Sacada/varanda': 1.4, 'Piscina': 1.6, 'Escada': 1.2, 'Quadra esportiva': 2.5 }, is_required: true },
      { question: 'Quantos vãos/aberturas?', field_type: 'SELECT', options: ['1-2', '3-5', '6-10', 'Mais de 10'], affects_price: true, price_modifier: { '1-2': 1, '3-5': 1.8, '6-10': 3, 'Mais de 10': 4.5 }, is_required: true },
      { question: 'Motivo principal?', field_type: 'RADIO', options: ['Proteção de crianças', 'Proteção de pets', 'Pombos/aves', 'Segurança geral'], affects_price: false, is_required: true },
      { question: 'Foto do local', field_type: 'PHOTO', is_required: true },
    ],
  },
  {
    group: 'para-sua-casa', name: 'Horta em Casa', slug: 'horta-em-casa', icon: '🌱',
    description: 'Montagem e manutenção de hortas caseiras e verticais', min: 100, max: 600, hours: 3,
    questions: [
      { question: 'Tipo de horta?', field_type: 'RADIO', options: ['Horta vertical (parede/varanda)', 'Canteiros no quintal', 'Vasos e jardineiras', 'Manutenção de horta existente'], affects_price: true, price_modifier: { 'Horta vertical (parede/varanda)': 1.2, 'Canteiros no quintal': 1.4, 'Vasos e jardineiras': 1, 'Manutenção de horta existente': 0.6 }, is_required: true },
      { question: 'Os materiais (terra, mudas, vasos) já estão comprados?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.5 }, is_required: true },
      { question: 'Foto do espaço disponível', field_type: 'PHOTO', is_required: true },
    ],
  },

  // ════════════ 🚗 PARA SEU CARRO (reforço) ════════════
  {
    group: 'para-seu-carro', name: 'Martelinho de Ouro', slug: 'martelinho-de-ouro', icon: '🔨',
    description: 'Remoção de amassados sem pintura (PDR)', min: 150, max: 800, hours: 3,
    questions: [
      { question: 'Quantos amassados?', field_type: 'RADIO', options: ['1 pequeno', '2-3 pequenos', '1 grande', 'Vários (granizo)'], affects_price: true, price_modifier: { '1 pequeno': 1, '2-3 pequenos': 1.8, '1 grande': 1.6, 'Vários (granizo)': 3.5 }, is_required: true },
      { question: 'Em qual peça?', field_type: 'SELECT', options: ['Porta', 'Capô', 'Paralama', 'Teto', 'Tampa traseira', 'Várias peças'], affects_price: true, price_modifier: { 'Teto': 1.4, 'Várias peças': 2 }, is_required: true },
      { question: 'A pintura está intacta (sem riscos)?', field_type: 'BOOLEAN', is_required: true, help_text: 'O martelinho só funciona quando a pintura não foi danificada' },
      { question: 'Foto do amassado', field_type: 'PHOTO', is_required: true },
    ],
  },
  {
    group: 'para-seu-carro', name: 'Troca de Para-brisa / Vidros', slug: 'troca-parabrisa', icon: '🚘',
    description: 'Troca e reparo de para-brisas, vidros e retrovisores', min: 200, max: 1200, hours: 2,
    questions: [
      { question: 'Qual vidro?', field_type: 'SELECT', options: ['Para-brisa (dianteiro)', 'Vigia (traseiro)', 'Vidro de porta', 'Retrovisor', 'Reparo de trinca (sem troca)'], affects_price: true, price_modifier: { 'Para-brisa (dianteiro)': 1.5, 'Vigia (traseiro)': 1.3, 'Vidro de porta': 1, 'Retrovisor': 0.7, 'Reparo de trinca (sem troca)': 0.4 }, is_required: true },
      { question: 'Marca, modelo e ano do veículo', field_type: 'TEXT', is_required: true, placeholder: 'Ex: Onix 2022' },
      { question: 'O carro tem sensor de chuva ou câmera no para-brisa?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.3, 'false': 1 }, is_required: true },
      { question: 'Foto do dano', field_type: 'PHOTO', is_required: true },
    ],
  },
  {
    group: 'para-seu-carro', name: 'Elétrica Automotiva', slug: 'eletrica-automotiva', icon: '🔋',
    description: 'Diagnóstico e reparo do sistema elétrico do veículo', min: 100, max: 800, hours: 2,
    questions: [
      { question: 'Qual o problema?', field_type: 'SELECT', options: ['Bateria descarregando', 'Carro não dá partida', 'Farol/lanterna queimados', 'Vidro elétrico', 'Trava elétrica', 'Painel com luzes acesas', 'Chicote/fiação', 'Outro'], affects_price: true, price_modifier: { 'Carro não dá partida': 1.3, 'Painel com luzes acesas': 1.2, 'Chicote/fiação': 1.6, 'Farol/lanterna queimados': 0.6 }, is_required: true },
      { question: 'O atendimento é urgente (carro parado)?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.4, 'false': 1 }, is_required: true },
      { question: 'Marca, modelo e ano do veículo', field_type: 'TEXT', is_required: true, placeholder: 'Ex: HB20 2020' },
    ],
  },
  {
    group: 'para-seu-carro', name: 'Mecânica de Motos', slug: 'mecanica-motos', icon: '🏍️',
    description: 'Manutenção e reparo de motocicletas e scooters', min: 80, max: 600, hours: 2,
    questions: [
      { question: 'Qual serviço?', field_type: 'SELECT', options: ['Revisão geral', 'Troca de óleo e filtros', 'Relação (corrente/coroa/pinhão)', 'Freios', 'Suspensão', 'Elétrica da moto', 'Pneu/câmara', 'Outro'], affects_price: true, price_modifier: { 'Revisão geral': 1.5, 'Troca de óleo e filtros': 0.6, 'Relação (corrente/coroa/pinhão)': 1, 'Suspensão': 1.3 }, is_required: true },
      { question: 'As peças já estão compradas?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.3 }, is_required: true },
      { question: 'Marca, modelo e ano da moto', field_type: 'TEXT', is_required: true, placeholder: 'Ex: CG 160 2021' },
    ],
  },
  {
    group: 'para-seu-carro', name: 'Higienização do Ar Automotivo', slug: 'higienizacao-ar-automotivo', icon: '🌬️',
    description: 'Limpeza do ar-condicionado, troca de filtro e eliminação de odores', min: 80, max: 300, hours: 1,
    questions: [
      { question: 'Qual serviço?', field_type: 'RADIO', options: ['Higienização do ar-condicionado', 'Troca do filtro de cabine', 'Higienização + filtro', 'Ar não gela (diagnóstico)'], affects_price: true, price_modifier: { 'Higienização do ar-condicionado': 1, 'Troca do filtro de cabine': 0.6, 'Higienização + filtro': 1.4, 'Ar não gela (diagnóstico)': 1.3 }, is_required: true },
      { question: 'O profissional vai até você?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
      { question: 'Marca, modelo e ano do veículo', field_type: 'TEXT', is_required: true },
    ],
  },
  {
    group: 'para-seu-carro', name: 'Envelopamento', slug: 'envelopamento', icon: '🎨',
    description: 'Envelopamento total ou parcial, teto, colunas e detalhes', min: 300, max: 3000, hours: 8,
    questions: [
      { question: 'O que será envelopado?', field_type: 'SELECT', options: ['Carro inteiro', 'Teto', 'Capô', 'Colunas e detalhes', 'Interior (painel)', 'Frota/adesivação comercial'], affects_price: true, price_modifier: { 'Carro inteiro': 5, 'Teto': 1, 'Capô': 1.1, 'Colunas e detalhes': 0.7, 'Interior (painel)': 1.2, 'Frota/adesivação comercial': 4 }, is_required: true },
      { question: 'Tipo de material?', field_type: 'RADIO', options: ['Vinil fosco', 'Vinil brilhante', 'Fibra de carbono (texturizado)', 'Não sei / quero sugestão'], affects_price: true, price_modifier: { 'Vinil fosco': 1, 'Vinil brilhante': 1, 'Fibra de carbono (texturizado)': 1.3 }, is_required: true },
      { question: 'Porte do veículo?', field_type: 'RADIO', options: ['Carro pequeno', 'Carro médio', 'SUV/Caminhonete', 'Moto'], affects_price: true, price_modifier: { 'Carro pequeno': 1, 'Carro médio': 1.2, 'SUV/Caminhonete': 1.5, 'Moto': 0.6 }, is_required: true },
    ],
  },

  // ════════════ 💇 BELEZA E ESTÉTICA (reforço) ════════════
  {
    group: 'beleza-estetica', name: 'Tranças e Cabelo Afro', slug: 'trancas-cabelo-afro', icon: '👩🏾‍🦱',
    description: 'Box braids, tranças nagô, twists e cuidados com cabelo crespo', min: 80, max: 500, hours: 4,
    questions: [
      { question: 'Qual serviço?', field_type: 'SELECT', options: ['Box braids', 'Tranças nagô', 'Twists', 'Crochet braids', 'Manutenção/retoque', 'Hidratação e finalização', 'Corte para cabelo crespo'], affects_price: true, price_modifier: { 'Box braids': 2, 'Tranças nagô': 1.2, 'Twists': 1.6, 'Crochet braids': 1.8, 'Manutenção/retoque': 0.7, 'Hidratação e finalização': 0.6 }, is_required: true },
      { question: 'Comprimento desejado?', field_type: 'RADIO', options: ['Curto', 'Médio (ombro)', 'Longo (cintura)'], affects_price: true, price_modifier: { 'Curto': 0.8, 'Médio (ombro)': 1, 'Longo (cintura)': 1.4 }, is_required: true },
      { question: 'O material (jumbo/fibra) já está comprado?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.3 }, is_required: true },
      { question: 'Foto de referência', field_type: 'PHOTO', is_required: false },
    ],
  },
  {
    group: 'beleza-estetica', name: 'Alongamento de Cílios', slug: 'alongamento-cilios', icon: '👁️',
    description: 'Extensão de cílios fio a fio, volume russo e lash lifting', min: 80, max: 300, hours: 2,
    questions: [
      { question: 'Qual técnica?', field_type: 'SELECT', options: ['Fio a fio clássico', 'Volume russo', 'Volume brasileiro', 'Híbrido', 'Lash lifting', 'Manutenção', 'Remoção'], affects_price: true, price_modifier: { 'Fio a fio clássico': 1, 'Volume russo': 1.4, 'Volume brasileiro': 1.3, 'Híbrido': 1.2, 'Lash lifting': 0.9, 'Manutenção': 0.6, 'Remoção': 0.4 }, is_required: true },
      { question: 'É a primeira vez que faz alongamento?', field_type: 'BOOLEAN', is_required: true },
      { question: 'O profissional vai até você?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
    ],
  },
  {
    group: 'beleza-estetica', name: 'Podologia', slug: 'podologia', icon: '🦶',
    description: 'Tratamento de unhas encravadas, calos e saúde dos pés', min: 60, max: 250, hours: 1,
    questions: [
      { question: 'Qual o serviço?', field_type: 'SELECT', options: ['Podologia completa (limpeza + corte)', 'Unha encravada', 'Calos e calosidades', 'Micose/onicomicose', 'Órtese para unha', 'Pé diabético (cuidado especial)'], affects_price: true, price_modifier: { 'Podologia completa (limpeza + corte)': 1, 'Unha encravada': 1.2, 'Órtese para unha': 1.4, 'Pé diabético (cuidado especial)': 1.5 }, is_required: true },
      { question: 'O profissional vai até você?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
      { question: 'Tem diabetes ou problema circulatório?', field_type: 'BOOLEAN', is_required: true, help_text: 'Importante para o protocolo de atendimento' },
    ],
  },
  {
    group: 'beleza-estetica', name: 'Dia da Noiva / Debutante', slug: 'dia-da-noiva', icon: '👰',
    description: 'Pacote completo: cabelo, maquiagem e acompanhamento no grande dia', min: 300, max: 2000, hours: 5,
    questions: [
      { question: 'Qual o evento?', field_type: 'RADIO', options: ['Casamento (noiva)', 'Debutante (15 anos)', 'Formatura', 'Madrinhas/mães'], affects_price: true, price_modifier: { 'Casamento (noiva)': 1.5, 'Debutante (15 anos)': 1.2, 'Formatura': 1, 'Madrinhas/mães': 0.9 }, is_required: true },
      { question: 'O que está incluído?', field_type: 'SELECT', options: ['Cabelo + maquiagem', 'Cabelo + maquiagem + prova prévia', 'Pacote completo (com acompanhamento no local)'], affects_price: true, price_modifier: { 'Cabelo + maquiagem': 1, 'Cabelo + maquiagem + prova prévia': 1.4, 'Pacote completo (com acompanhamento no local)': 1.8 }, is_required: true },
      { question: 'Para quantas pessoas além da noiva/debutante?', field_type: 'SELECT', options: ['Somente ela', '1-3 acompanhantes', '4+ acompanhantes'], affects_price: true, price_modifier: { 'Somente ela': 1, '1-3 acompanhantes': 1.8, '4+ acompanhantes': 2.8 }, is_required: true },
      { question: 'Foto de referência do estilo', field_type: 'PHOTO', is_required: false },
    ],
  },

  // ════════════ 🐾 PARA SEU PET (reforço) ════════════
  {
    group: 'para-seu-pet', name: 'Pet Sitter (na sua casa)', slug: 'pet-sitter', icon: '🏠',
    description: 'Cuidador visita ou fica com seu pet na sua casa', min: 50, max: 200, hours: 2,
    questions: [
      { question: 'Tipo de atendimento?', field_type: 'RADIO', options: ['Visitas diárias (alimentar/brincar)', 'Pernoite na minha casa', 'Período integral'], affects_price: true, price_modifier: { 'Visitas diárias (alimentar/brincar)': 1, 'Pernoite na minha casa': 2, 'Período integral': 2.8 }, is_required: true },
      { question: 'Quantos pets?', field_type: 'RADIO', options: ['1', '2', '3 ou mais'], affects_price: true, price_modifier: { '1': 1, '2': 1.4, '3 ou mais': 1.8 }, is_required: true },
      { question: 'Por quantos dias?', field_type: 'SELECT', options: ['1-2 dias', '3-7 dias', 'Mais de 1 semana'], affects_price: true, price_modifier: { '1-2 dias': 1, '3-7 dias': 2.5, 'Mais de 1 semana': 4 }, is_required: true },
      { question: 'Algum pet precisa de medicação ou cuidado especial?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
    ],
  },
  {
    group: 'para-seu-pet', name: 'Vacinação em Domicílio', slug: 'vacinacao-pet', icon: '💉',
    description: 'Aplicação de vacinas em cães e gatos na sua casa', min: 80, max: 300, hours: 1,
    questions: [
      { question: 'Qual vacina?', field_type: 'SELECT', options: ['V8/V10 (cães)', 'Antirrábica', 'Quádrupla/quíntupla felina', 'Gripe canina', 'Giárdia', 'Não sei / quero orientação'], affects_price: true, price_modifier: { 'V8/V10 (cães)': 1, 'Antirrábica': 0.7, 'Quádrupla/quíntupla felina': 1.1, 'Não sei / quero orientação': 1 }, is_required: true },
      { question: 'Quantos animais?', field_type: 'RADIO', options: ['1', '2', '3 ou mais'], affects_price: true, price_modifier: { '1': 1, '2': 1.7, '3 ou mais': 2.4 }, is_required: true },
      { question: 'O pet tem carteira de vacinação?', field_type: 'BOOLEAN', is_required: true },
    ],
  },

  // ════════════ 💻 TECH E DIGITAL (reforço) ════════════
  {
    group: 'tech-digital', name: 'Instalação de Antenas / Starlink', slug: 'instalacao-antenas', icon: '📡',
    description: 'Antenas digitais, parabólicas e internet via satélite', min: 150, max: 600, hours: 2,
    questions: [
      { question: 'Tipo de antena?', field_type: 'SELECT', options: ['Antena digital (TV aberta)', 'Parabólica', 'Starlink / internet satélite', 'Antena rural de celular', 'Apontamento/ajuste de antena existente'], affects_price: true, price_modifier: { 'Antena digital (TV aberta)': 1, 'Parabólica': 1.3, 'Starlink / internet satélite': 1.6, 'Antena rural de celular': 1.5, 'Apontamento/ajuste de antena existente': 0.6 }, is_required: true },
      { question: 'O equipamento já está comprado?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.4 }, is_required: true },
      { question: 'Altura da instalação?', field_type: 'RADIO', options: ['Telhado de casa térrea', 'Sobrado', 'Mastro/torre'], affects_price: true, price_modifier: { 'Telhado de casa térrea': 1, 'Sobrado': 1.2, 'Mastro/torre': 1.6 }, is_required: true },
    ],
  },

  // ════════════ 📦 ENTREGAS E TAREFAS (reforço — gigs) ════════════
  {
    group: 'entregas-logistica', name: 'Fila e Espera', slug: 'fila-espera', icon: '⏳',
    description: 'Alguém para pegar fila, aguardar entrega ou fazer espera por você', min: 50, max: 200, hours: 3,
    questions: [
      { question: 'Tipo de espera?', field_type: 'SELECT', options: ['Fila (cartório, banco, ingresso)', 'Aguardar entrega/técnico em casa', 'Retirar documento/encomenda', 'Outro'], affects_price: true, price_modifier: { 'Fila (cartório, banco, ingresso)': 1, 'Aguardar entrega/técnico em casa': 1.2, 'Retirar documento/encomenda': 0.8 }, is_required: true },
      { question: 'Duração estimada?', field_type: 'RADIO', options: ['Até 1 hora', '1-3 horas', '3-6 horas', 'Dia todo'], affects_price: true, price_modifier: { 'Até 1 hora': 1, '1-3 horas': 1.8, '3-6 horas': 3, 'Dia todo': 5 }, is_required: true },
      { question: 'Descreva os detalhes (local, horário, o que fazer)', field_type: 'TEXTAREA', is_required: true },
    ],
  },
  {
    group: 'entregas-logistica', name: 'Ajudante Geral por Hora', slug: 'ajudante-por-hora', icon: '💪',
    description: 'Ajuda braçal para qualquer tarefa: quintal, garagem, pequenos trabalhos', min: 40, max: 150, hours: 4,
    questions: [
      { question: 'Tipo de ajuda?', field_type: 'SELECT', options: ['Limpar quintal/terreno', 'Organizar/carregar coisas', 'Ajuda em obra/reforma', 'Tarefas gerais da casa', 'Outro'], affects_price: true, price_modifier: { 'Ajuda em obra/reforma': 1.3, 'Limpar quintal/terreno': 1.1 }, is_required: true },
      { question: 'Por quantas horas?', field_type: 'RADIO', options: ['2 horas', '4 horas', 'Diária (8h)'], affects_price: true, price_modifier: { '2 horas': 1, '4 horas': 1.8, 'Diária (8h)': 3.2 }, is_required: true },
      { question: 'Precisa que o ajudante traga ferramentas?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
      { question: 'Descreva a tarefa', field_type: 'TEXTAREA', is_required: true },
    ],
  },
  {
    group: 'entregas-logistica', name: 'Doações e Descarte', slug: 'doacoes-descarte', icon: '♻️',
    description: 'Retirada de móveis, roupas e itens para doação ou descarte correto', min: 80, max: 300, hours: 2,
    questions: [
      { question: 'O que será retirado?', field_type: 'SELECT', options: ['Sacolas de roupas/itens pequenos', 'Móvel(is)', 'Eletrodomésticos', 'Entulho leve', 'Mistura de itens'], affects_price: true, price_modifier: { 'Sacolas de roupas/itens pequenos': 1, 'Móvel(is)': 1.5, 'Eletrodomésticos': 1.4, 'Mistura de itens': 1.8 }, is_required: true },
      { question: 'Destino?', field_type: 'RADIO', options: ['Doação (instituição)', 'Descarte/ecoponto', 'Tanto faz — o que for melhor'], affects_price: false, is_required: true },
      { question: 'Volume aproximado?', field_type: 'RADIO', options: ['Cabe em carro', 'Precisa de caminhonete', 'Precisa de caminhão pequeno'], affects_price: true, price_modifier: { 'Cabe em carro': 1, 'Precisa de caminhonete': 1.5, 'Precisa de caminhão pequeno': 2.2 }, is_required: true },
      { question: 'Foto dos itens', field_type: 'PHOTO', is_required: false },
    ],
  },
  {
    group: 'entregas-logistica', name: 'Cuidar da Casa em Viagem', slug: 'house-sitting', icon: '🏠',
    description: 'Visitas de checagem, correspondência e cuidados enquanto você viaja', min: 100, max: 400, hours: 1,
    questions: [
      { question: 'O que precisa ser feito?', field_type: 'SELECT', options: ['Visitas de checagem (segurança)', 'Recolher correspondência', 'Regar plantas + checagem', 'Pacote completo (plantas, correio, luzes)'], affects_price: true, price_modifier: { 'Visitas de checagem (segurança)': 1, 'Recolher correspondência': 0.8, 'Regar plantas + checagem': 1.2, 'Pacote completo (plantas, correio, luzes)': 1.5 }, is_required: true },
      { question: 'Por quanto tempo?', field_type: 'SELECT', options: ['Fim de semana', '1 semana', '2 semanas', 'Mais de 2 semanas'], affects_price: true, price_modifier: { 'Fim de semana': 1, '1 semana': 2, '2 semanas': 3.5, 'Mais de 2 semanas': 5 }, is_required: true },
      { question: 'Frequência de visitas?', field_type: 'RADIO', options: ['Diária', 'Dia sim, dia não', '2x por semana'], affects_price: true, price_modifier: { 'Diária': 1.5, 'Dia sim, dia não': 1.2, '2x por semana': 1 }, is_required: true },
    ],
  },
  {
    group: 'entregas-logistica', name: 'Regar Plantas em Viagem', slug: 'regar-plantas', icon: '🪴',
    description: 'Cuidado com plantas e jardim durante sua ausência', min: 50, max: 200, hours: 1,
    questions: [
      { question: 'Quantas plantas aproximadamente?', field_type: 'RADIO', options: ['Poucas (até 10 vasos)', 'Médio (10-30 vasos)', 'Muitas (30+ ou jardim)'], affects_price: true, price_modifier: { 'Poucas (até 10 vasos)': 1, 'Médio (10-30 vasos)': 1.4, 'Muitas (30+ ou jardim)': 2 }, is_required: true },
      { question: 'Por quanto tempo?', field_type: 'SELECT', options: ['Fim de semana', '1 semana', '2 semanas ou mais'], affects_price: true, price_modifier: { 'Fim de semana': 1, '1 semana': 1.8, '2 semanas ou mais': 3 }, is_required: true },
      { question: 'Alguma planta exige cuidado especial (orquídeas, bonsai)?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
    ],
  },
  {
    group: 'entregas-logistica', name: 'Decoração Sazonal (Natal/Festas)', slug: 'decoracao-sazonal', icon: '🎄',
    description: 'Montagem e desmontagem de árvore de Natal, luzes e enfeites', min: 100, max: 500, hours: 3,
    questions: [
      { question: 'Qual serviço?', field_type: 'RADIO', options: ['Montar decoração', 'Desmontar e guardar', 'Montar + desmontar (pacote)'], affects_price: true, price_modifier: { 'Montar decoração': 1, 'Desmontar e guardar': 0.7, 'Montar + desmontar (pacote)': 1.5 }, is_required: true },
      { question: 'Tamanho da decoração?', field_type: 'RADIO', options: ['Árvore simples', 'Árvore + luzes internas', 'Casa completa (interna + fachada)'], affects_price: true, price_modifier: { 'Árvore simples': 1, 'Árvore + luzes internas': 1.5, 'Casa completa (interna + fachada)': 2.5 }, is_required: true },
      { question: 'Os enfeites já estão comprados?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.4 }, is_required: true },
    ],
  },

  // ════════════ 🎉 EVENTOS E FESTAS (reforço) ════════════
  {
    group: 'eventos-festas', name: 'Buffet Completo', slug: 'buffet-completo', icon: '🍽️',
    description: 'Buffet para festas e eventos com comida, equipe e louças', min: 500, max: 10000, hours: 8,
    questions: [
      { question: 'Tipo de evento?', field_type: 'SELECT', options: ['Aniversário', 'Casamento', 'Evento corporativo', 'Confraternização', 'Formatura'], affects_price: true, price_modifier: { 'Casamento': 1.8, 'Evento corporativo': 1.4, 'Formatura': 1.5 }, is_required: true },
      { question: 'Quantos convidados?', field_type: 'SELECT', options: ['Até 30', '30-70', '70-150', '150-300', 'Acima de 300'], affects_price: true, price_modifier: { 'Até 30': 1, '30-70': 2, '70-150': 3.5, '150-300': 6, 'Acima de 300': 10 }, is_required: true },
      { question: 'Tipo de cardápio?', field_type: 'RADIO', options: ['Coquetel/finger food', 'Almoço/jantar servido', 'Churrasco', 'Coffee break'], affects_price: true, price_modifier: { 'Coquetel/finger food': 1, 'Almoço/jantar servido': 1.5, 'Churrasco': 1.2, 'Coffee break': 0.7 }, is_required: true },
      { question: 'Inclui garçons e louças?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.3, 'false': 1 }, is_required: true },
    ],
  },
  {
    group: 'eventos-festas', name: 'Bolos e Doces para Festas', slug: 'bolos-doces', icon: '🎂',
    description: 'Bolos decorados, doces finos e kits festa', min: 100, max: 1500, hours: 8,
    questions: [
      { question: 'O que você precisa?', field_type: 'SELECT', options: ['Bolo decorado', 'Doces (brigadeiros, beijinhos...)', 'Doces finos', 'Kit festa completo (bolo + doces + salgados)', 'Bolo de andares (casamento)'], affects_price: true, price_modifier: { 'Bolo decorado': 1, 'Doces (brigadeiros, beijinhos...)': 0.7, 'Doces finos': 1.2, 'Kit festa completo (bolo + doces + salgados)': 2, 'Bolo de andares (casamento)': 3 }, is_required: true },
      { question: 'Para quantas pessoas?', field_type: 'SELECT', options: ['Até 20', '20-50', '50-100', 'Acima de 100'], affects_price: true, price_modifier: { 'Até 20': 1, '20-50': 1.8, '50-100': 3, 'Acima de 100': 5 }, is_required: true },
      { question: 'Tema da festa e referências', field_type: 'TEXTAREA', is_required: true, placeholder: 'Ex: festa da Minnie, tons de rosa e dourado' },
      { question: 'Foto de referência', field_type: 'PHOTO', is_required: false },
    ],
  },
  {
    group: 'eventos-festas', name: 'Aluguel de Brinquedos', slug: 'aluguel-brinquedos', icon: '🎠',
    description: 'Pula-pula, piscina de bolinhas, tobogã e brinquedos para festas', min: 150, max: 800, hours: 6,
    questions: [
      { question: 'Quais brinquedos?', field_type: 'SELECT', options: ['Pula-pula/cama elástica', 'Piscina de bolinhas', 'Tobogã inflável', 'Castelo inflável', 'Kit com 2-3 brinquedos', 'Kit completo (4+)'], affects_price: true, price_modifier: { 'Pula-pula/cama elástica': 1, 'Piscina de bolinhas': 0.9, 'Tobogã inflável': 1.5, 'Castelo inflável': 1.4, 'Kit com 2-3 brinquedos': 2.2, 'Kit completo (4+)': 3.5 }, is_required: true },
      { question: 'Duração da festa?', field_type: 'RADIO', options: ['Até 4 horas', '4-8 horas', 'Dia todo'], affects_price: true, price_modifier: { 'Até 4 horas': 1, '4-8 horas': 1.3, 'Dia todo': 1.6 }, is_required: true },
      { question: 'Com monitor(a) para as crianças?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.4, 'false': 1 }, is_required: true },
      { question: 'O local é coberto ou ao ar livre?', field_type: 'RADIO', options: ['Coberto', 'Ao ar livre', 'Os dois'], affects_price: false, is_required: true },
    ],
  },
  {
    group: 'eventos-festas', name: 'Cerimonialista / Assessoria', slug: 'cerimonialista', icon: '💍',
    description: 'Organização e assessoria de casamentos e grandes eventos', min: 500, max: 5000, hours: 40,
    questions: [
      { question: 'Tipo de assessoria?', field_type: 'RADIO', options: ['Assessoria completa (do zero)', 'Assessoria parcial (últimos meses)', 'Só o dia do evento', 'Consultoria pontual'], affects_price: true, price_modifier: { 'Assessoria completa (do zero)': 3, 'Assessoria parcial (últimos meses)': 1.8, 'Só o dia do evento': 1, 'Consultoria pontual': 0.5 }, is_required: true },
      { question: 'Tipo de evento?', field_type: 'RADIO', options: ['Casamento', 'Debutante (15 anos)', 'Bodas', 'Evento corporativo'], affects_price: true, price_modifier: { 'Casamento': 1.3 }, is_required: true },
      { question: 'Quantos convidados previstos?', field_type: 'SELECT', options: ['Até 50', '50-150', '150-300', 'Acima de 300'], affects_price: true, price_modifier: { 'Até 50': 1, '50-150': 1.4, '150-300': 1.9, 'Acima de 300': 2.5 }, is_required: true },
      { question: 'Data prevista do evento', field_type: 'TEXT', is_required: true, placeholder: 'Ex: 15/11/2026' },
    ],
  },
  {
    group: 'eventos-festas', name: 'Cabine de Fotos / Totem', slug: 'cabine-fotos', icon: '📸',
    description: 'Cabine fotográfica, totem e plataforma 360 para eventos', min: 300, max: 1500, hours: 5,
    questions: [
      { question: 'Tipo de equipamento?', field_type: 'RADIO', options: ['Cabine de fotos (impressão)', 'Totem digital (envio por QR)', 'Plataforma 360°', 'Espelho mágico'], affects_price: true, price_modifier: { 'Cabine de fotos (impressão)': 1, 'Totem digital (envio por QR)': 0.9, 'Plataforma 360°': 1.5, 'Espelho mágico': 1.4 }, is_required: true },
      { question: 'Duração?', field_type: 'RADIO', options: ['2 horas', '3-4 horas', '5+ horas'], affects_price: true, price_modifier: { '2 horas': 1, '3-4 horas': 1.4, '5+ horas': 1.9 }, is_required: true },
      { question: 'Com adereços e personalização do tema?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
    ],
  },
  {
    group: 'eventos-festas', name: 'Churrasqueiro', slug: 'churrasqueiro', icon: '🍖',
    description: 'Churrasqueiro profissional com ou sem a carne inclusa', min: 200, max: 1500, hours: 6,
    questions: [
      { question: 'Para quantas pessoas?', field_type: 'SELECT', options: ['Até 20', '20-50', '50-100', 'Acima de 100'], affects_price: true, price_modifier: { 'Até 20': 1, '20-50': 1.8, '50-100': 3, 'Acima de 100': 5 }, is_required: true },
      { question: 'A carne e os insumos já estão comprados?', field_type: 'RADIO', options: ['Sim, tudo comprado', 'Quero que o churrasqueiro traga tudo', 'Quero ajuda com a lista de compras'], affects_price: true, price_modifier: { 'Sim, tudo comprado': 1, 'Quero que o churrasqueiro traga tudo': 2.5, 'Quero ajuda com a lista de compras': 1.1 }, is_required: true },
      { question: 'Inclui espetinhos/acompanhamentos preparados?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.3, 'false': 1 }, is_required: true },
      { question: 'Tem churrasqueira no local?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.4 }, is_required: true },
    ],
  },

  // ════════════ 📚 EDUCAÇÃO E AULAS (reforço) ════════════
  {
    group: 'educacao-aulas', name: 'Preparatório ENEM / Concursos', slug: 'preparatorio-enem-concursos', icon: '📝',
    description: 'Aulas e mentoria para ENEM, vestibulares e concursos públicos', min: 60, max: 200, hours: 2,
    questions: [
      { question: 'Qual objetivo?', field_type: 'RADIO', options: ['ENEM/vestibular', 'Concurso público', 'OAB/provas de conselho', 'Militar (ESA, EsPCEx...)'], affects_price: false, is_required: true },
      { question: 'Quais matérias?', field_type: 'SELECT', options: ['Matemática', 'Redação', 'Português', 'Ciências da natureza', 'Humanas', 'Todas (mentoria completa)'], affects_price: true, price_modifier: { 'Redação': 1.1, 'Todas (mentoria completa)': 1.6 }, is_required: true },
      { question: 'Formato?', field_type: 'RADIO', options: ['Presencial', 'Online', 'Tanto faz'], affects_price: true, price_modifier: { 'Presencial': 1.2, 'Online': 1 }, is_required: true },
      { question: 'Quando é a prova?', field_type: 'TEXT', is_required: false, placeholder: 'Ex: novembro/2026' },
    ],
  },
  {
    group: 'educacao-aulas', name: 'Tecnologia para Idosos', slug: 'tecnologia-idosos', icon: '📱',
    description: 'Aulas pacientes de celular, WhatsApp e internet para a melhor idade', min: 50, max: 150, hours: 1,
    questions: [
      { question: 'O que quer aprender?', field_type: 'SELECT', options: ['Usar o celular (básico)', 'WhatsApp e videochamadas', 'Apps de banco e Pix com segurança', 'Redes sociais', 'Computador/notebook', 'Tudo (curso completo)'], affects_price: true, price_modifier: { 'Tudo (curso completo)': 1.5, 'Apps de banco e Pix com segurança': 1.1 }, is_required: true },
      { question: 'Formato?', field_type: 'RADIO', options: ['Presencial (na casa do aluno)', 'Online com ajuda de um familiar'], affects_price: true, price_modifier: { 'Presencial (na casa do aluno)': 1.2, 'Online com ajuda de um familiar': 1 }, is_required: true },
      { question: 'Quantas aulas por semana?', field_type: 'RADIO', options: ['1 aula', '2 aulas', '3+ aulas'], affects_price: true, price_modifier: { '1 aula': 1, '2 aulas': 1.9, '3+ aulas': 2.7 }, is_required: true },
    ],
  },

  // ════════════ 🏥 SAÚDE E CUIDADOS (reforço) ════════════
  {
    group: 'saude-em-casa', name: 'Acompanhante Hospitalar', slug: 'acompanhante-hospitalar', icon: '🏥',
    description: 'Acompanhante para internações, exames e consultas', min: 100, max: 400, hours: 12,
    questions: [
      { question: 'Tipo de acompanhamento?', field_type: 'RADIO', options: ['Internação (plantão diurno)', 'Internação (plantão noturno)', 'Acompanhar em consulta/exame', 'Pós-cirúrgico em casa'], affects_price: true, price_modifier: { 'Internação (plantão diurno)': 1, 'Internação (plantão noturno)': 1.3, 'Acompanhar em consulta/exame': 0.5, 'Pós-cirúrgico em casa': 1.1 }, is_required: true },
      { question: 'O paciente é?', field_type: 'RADIO', options: ['Idoso', 'Adulto', 'Criança'], affects_price: false, is_required: true },
      { question: 'O paciente precisa de ajuda para se locomover/higiene?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
      { question: 'Por quantos dias?', field_type: 'SELECT', options: ['1 dia', '2-5 dias', 'Mais de 5 dias'], affects_price: true, price_modifier: { '1 dia': 1, '2-5 dias': 2.5, 'Mais de 5 dias': 4 }, is_required: true },
    ],
  },
  {
    group: 'saude-em-casa', name: 'Fonoaudiologia', slug: 'fonoaudiologia', icon: '🗣️',
    description: 'Fonoaudiólogo em domicílio para fala, voz e deglutição', min: 100, max: 300, hours: 1,
    questions: [
      { question: 'Qual a necessidade?', field_type: 'SELECT', options: ['Atraso de fala (criança)', 'Gagueira', 'Voz (rouquidão, uso profissional)', 'Deglutição/disfagia (idoso)', 'Reabilitação pós-AVC', 'Processamento auditivo'], affects_price: true, price_modifier: { 'Reabilitação pós-AVC': 1.3, 'Deglutição/disfagia (idoso)': 1.2 }, is_required: true },
      { question: 'Idade do paciente?', field_type: 'RADIO', options: ['Criança (até 12)', 'Adolescente', 'Adulto', 'Idoso'], affects_price: false, is_required: true },
      { question: 'Frequência desejada?', field_type: 'RADIO', options: ['1x por semana', '2x por semana', 'Avaliação única'], affects_price: true, price_modifier: { '1x por semana': 1, '2x por semana': 1.9, 'Avaliação única': 1.2 }, is_required: true },
    ],
  },
  {
    group: 'saude-em-casa', name: 'Aplicação de Injetáveis', slug: 'aplicacao-injetaveis', icon: '💉',
    description: 'Aplicação de injeções e medicamentos por profissional habilitado', min: 50, max: 150, hours: 1,
    questions: [
      { question: 'Tipo de aplicação?', field_type: 'RADIO', options: ['Intramuscular', 'Subcutânea (ex: insulina, anticoagulante)', 'Não sei — está na receita'], affects_price: false, is_required: true },
      { question: 'Aplicação única ou tratamento?', field_type: 'RADIO', options: ['Dose única', 'Tratamento (várias doses)'], affects_price: true, price_modifier: { 'Dose única': 1, 'Tratamento (várias doses)': 2 }, is_required: true },
      { question: 'Tem receita médica?', field_type: 'BOOLEAN', is_required: true, help_text: 'A aplicação exige prescrição médica' },
    ],
  },

  // ════════════ 🖥️ FREELANCERS DIGITAIS (reforço) ════════════
  {
    group: 'freelancers-digitais', name: 'Tráfego Pago (Google/Meta Ads)', slug: 'trafego-pago', icon: '💹',
    description: 'Gestão de anúncios no Google, Instagram, Facebook e TikTok', min: 300, max: 3000, hours: 10,
    questions: [
      { question: 'Onde quer anunciar?', field_type: 'SELECT', options: ['Instagram/Facebook (Meta)', 'Google (pesquisa/YouTube)', 'TikTok', 'Várias plataformas'], affects_price: true, price_modifier: { 'Várias plataformas': 1.6 }, is_required: true },
      { question: 'Orçamento mensal de mídia (sem contar o gestor)?', field_type: 'SELECT', options: ['Até R$ 500', 'R$ 500-2.000', 'R$ 2.000-10.000', 'Acima de R$ 10.000'], affects_price: true, price_modifier: { 'Até R$ 500': 1, 'R$ 500-2.000': 1.3, 'R$ 2.000-10.000': 2, 'Acima de R$ 10.000': 3 }, is_required: true },
      { question: 'Objetivo principal?', field_type: 'RADIO', options: ['Vendas online', 'Leads/contatos', 'Movimento na loja física', 'Seguidores/marca'], affects_price: false, is_required: true },
      { question: 'Descreva seu negócio', field_type: 'TEXTAREA', is_required: true },
    ],
  },
  {
    group: 'freelancers-digitais', name: 'Loja Virtual / E-commerce', slug: 'loja-virtual', icon: '🛒',
    description: 'Criação de lojas em Shopify, Nuvemshop, WooCommerce e marketplaces', min: 500, max: 5000, hours: 30,
    questions: [
      { question: 'Tipo de projeto?', field_type: 'SELECT', options: ['Loja nova do zero', 'Migrar loja existente', 'Melhorias em loja atual', 'Integração com marketplace (Shopee, ML)'], affects_price: true, price_modifier: { 'Loja nova do zero': 1.5, 'Migrar loja existente': 1.2, 'Melhorias em loja atual': 0.7, 'Integração com marketplace (Shopee, ML)': 0.9 }, is_required: true },
      { question: 'Quantos produtos aproximadamente?', field_type: 'SELECT', options: ['Até 30', '30-100', '100-500', 'Acima de 500'], affects_price: true, price_modifier: { 'Até 30': 1, '30-100': 1.3, '100-500': 1.8, 'Acima de 500': 2.5 }, is_required: true },
      { question: 'Já tem identidade visual (logo, cores)?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.3 }, is_required: true },
    ],
  },
  {
    group: 'freelancers-digitais', name: 'Fotografia de Produto', slug: 'fotografia-produto', icon: '📷',
    description: 'Fotos profissionais de produtos para loja online e cardápios', min: 150, max: 1500, hours: 4,
    questions: [
      { question: 'Tipo de produto?', field_type: 'SELECT', options: ['Roupas/acessórios', 'Comida (cardápio)', 'Joias/semijoias', 'Produtos diversos', 'Com modelo(a)'], affects_price: true, price_modifier: { 'Comida (cardápio)': 1.2, 'Joias/semijoias': 1.3, 'Com modelo(a)': 2 }, is_required: true },
      { question: 'Quantos produtos/itens?', field_type: 'SELECT', options: ['Até 10', '10-30', '30-80', 'Acima de 80'], affects_price: true, price_modifier: { 'Até 10': 1, '10-30': 1.8, '30-80': 3, 'Acima de 80': 4.5 }, is_required: true },
      { question: 'Onde será o ensaio?', field_type: 'RADIO', options: ['No estúdio do fotógrafo', 'No meu estabelecimento', 'Tanto faz'], affects_price: false, is_required: true },
    ],
  },
  {
    group: 'freelancers-digitais', name: 'Locução e Narração', slug: 'locucao-narracao', icon: '🎙️',
    description: 'Locução para vídeos, propagandas, audiobooks e URA telefônica', min: 100, max: 800, hours: 2,
    questions: [
      { question: 'Tipo de locução?', field_type: 'SELECT', options: ['Propaganda (rádio/carro de som)', 'Vídeo institucional/YouTube', 'URA telefônica', 'Audiobook/e-learning', 'Vinheta'], affects_price: true, price_modifier: { 'Propaganda (rádio/carro de som)': 1, 'Vídeo institucional/YouTube': 1.2, 'URA telefônica': 0.8, 'Audiobook/e-learning': 2, 'Vinheta': 0.7 }, is_required: true },
      { question: 'Tamanho do texto?', field_type: 'RADIO', options: ['Até 30 segundos', '30s - 2 minutos', '2-10 minutos', 'Acima de 10 minutos'], affects_price: true, price_modifier: { 'Até 30 segundos': 1, '30s - 2 minutos': 1.4, '2-10 minutos': 2.2, 'Acima de 10 minutos': 3.5 }, is_required: true },
      { question: 'Tipo de voz?', field_type: 'RADIO', options: ['Masculina', 'Feminina', 'Infantil', 'Tanto faz'], affects_price: false, is_required: true },
    ],
  },
  {
    group: 'freelancers-digitais', name: 'Automação com IA / Chatbots', slug: 'automacao-ia-chatbots', icon: '🤖',
    description: 'Chatbots de WhatsApp, automações e agentes de IA para negócios', min: 300, max: 5000, hours: 20,
    questions: [
      { question: 'O que quer automatizar?', field_type: 'SELECT', options: ['Atendimento no WhatsApp', 'Agendamento automático', 'Respostas com IA (dúvidas de clientes)', 'Automação de planilhas/processos', 'Integração entre sistemas', 'Outro'], affects_price: true, price_modifier: { 'Atendimento no WhatsApp': 1, 'Respostas com IA (dúvidas de clientes)': 1.5, 'Integração entre sistemas': 1.8 }, is_required: true },
      { question: 'Volume de atendimentos/mês?', field_type: 'SELECT', options: ['Até 100', '100-500', '500-2.000', 'Acima de 2.000'], affects_price: true, price_modifier: { 'Até 100': 1, '100-500': 1.3, '500-2.000': 1.8, 'Acima de 2.000': 2.5 }, is_required: true },
      { question: 'Descreva seu negócio e o fluxo desejado', field_type: 'TEXTAREA', is_required: true },
    ],
  },

  // ════════════ 💼 NEGÓCIOS E ESCRITÓRIO ════════════
  {
    group: 'negocios-escritorio', name: 'Assistente Virtual / Secretariado', slug: 'assistente-virtual', icon: '💻',
    description: 'Agenda, e-mails, atendimento e rotinas administrativas remotas', min: 50, max: 300, hours: 4,
    questions: [
      { question: 'Quais tarefas?', field_type: 'SELECT', options: ['Agenda e e-mails', 'Atendimento a clientes', 'Emissão de notas/boletos', 'Planilhas e relatórios', 'Pacote completo'], affects_price: true, price_modifier: { 'Pacote completo': 1.8 }, is_required: true },
      { question: 'Quantas horas por semana?', field_type: 'RADIO', options: ['Até 5h', '5-10h', '10-20h', '20h+'], affects_price: true, price_modifier: { 'Até 5h': 1, '5-10h': 1.8, '10-20h': 3, '20h+': 4.5 }, is_required: true },
      { question: 'Descreva seu negócio e a rotina', field_type: 'TEXTAREA', is_required: true },
    ],
  },
  {
    group: 'negocios-escritorio', name: 'Contabilidade / Imposto de Renda', slug: 'contabilidade-ir', icon: '📊',
    description: 'Declaração de IR, MEI, abertura de empresa e contabilidade', min: 150, max: 800, hours: 4,
    questions: [
      { question: 'Qual serviço?', field_type: 'SELECT', options: ['Declaração de Imposto de Renda', 'Declaração anual MEI', 'Abertura de empresa/MEI', 'Regularização de pendências', 'Contabilidade mensal', 'Malha fina'], affects_price: true, price_modifier: { 'Declaração de Imposto de Renda': 1, 'Declaração anual MEI': 0.5, 'Abertura de empresa/MEI': 0.9, 'Regularização de pendências': 1.5, 'Contabilidade mensal': 1.8, 'Malha fina': 1.6 }, is_required: true },
      { question: 'Perfil?', field_type: 'RADIO', options: ['Pessoa física', 'MEI', 'Empresa (ME/EPP)', 'Autônomo/profissional liberal'], affects_price: true, price_modifier: { 'Pessoa física': 1, 'MEI': 0.8, 'Empresa (ME/EPP)': 1.6, 'Autônomo/profissional liberal': 1.2 }, is_required: true },
      { question: 'Tem investimentos, imóveis ou cripto a declarar?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.4, 'false': 1 }, is_required: true },
    ],
  },
  {
    group: 'negocios-escritorio', name: 'Tradução e Revisão de Textos', slug: 'traducao-revisao', icon: '🌐',
    description: 'Tradução, versão e revisão de documentos e textos', min: 80, max: 500, hours: 4,
    questions: [
      { question: 'Qual serviço?', field_type: 'RADIO', options: ['Tradução (outro idioma → português)', 'Versão (português → outro idioma)', 'Revisão ortográfica/gramatical', 'Revisão acadêmica (ABNT)'], affects_price: true, price_modifier: { 'Tradução (outro idioma → português)': 1, 'Versão (português → outro idioma)': 1.3, 'Revisão ortográfica/gramatical': 0.6, 'Revisão acadêmica (ABNT)': 0.9 }, is_required: true },
      { question: 'Idioma?', field_type: 'SELECT', options: ['Inglês', 'Espanhol', 'Francês', 'Alemão', 'Outro', 'Não se aplica (revisão PT)'], affects_price: true, price_modifier: { 'Francês': 1.3, 'Alemão': 1.5, 'Outro': 1.4 }, is_required: true },
      { question: 'Tamanho do texto?', field_type: 'SELECT', options: ['Até 3 páginas', '3-10 páginas', '10-30 páginas', 'Acima de 30 páginas'], affects_price: true, price_modifier: { 'Até 3 páginas': 1, '3-10 páginas': 2, '10-30 páginas': 4, 'Acima de 30 páginas': 7 }, is_required: true },
    ],
  },
  {
    group: 'negocios-escritorio', name: 'Digitação e Transcrição', slug: 'digitacao-transcricao', icon: '⌨️',
    description: 'Transcrição de áudios, digitação de documentos e planilhas', min: 50, max: 300, hours: 4,
    questions: [
      { question: 'Qual serviço?', field_type: 'RADIO', options: ['Transcrição de áudio/vídeo', 'Digitação de documento físico', 'Montagem de planilha', 'Formatação de trabalho (ABNT)'], affects_price: true, price_modifier: { 'Transcrição de áudio/vídeo': 1.2, 'Digitação de documento físico': 1, 'Montagem de planilha': 1.1, 'Formatação de trabalho (ABNT)': 0.9 }, is_required: true },
      { question: 'Volume?', field_type: 'SELECT', options: ['Até 30 min de áudio / 10 páginas', '30min-2h / 10-40 páginas', 'Acima de 2h / 40 páginas'], affects_price: true, price_modifier: { 'Até 30 min de áudio / 10 páginas': 1, '30min-2h / 10-40 páginas': 2.2, 'Acima de 2h / 40 páginas': 4 }, is_required: true },
      { question: 'Prazo de entrega?', field_type: 'RADIO', options: ['Urgente (24h)', 'Até 3 dias', 'Sem pressa'], affects_price: true, price_modifier: { 'Urgente (24h)': 1.5, 'Até 3 dias': 1.1, 'Sem pressa': 1 }, is_required: true },
    ],
  },
  {
    group: 'negocios-escritorio', name: 'Panfletagem / Promotor', slug: 'panfletagem-promotor', icon: '📣',
    description: 'Distribuição de panfletos, ações promocionais e divulgação', min: 80, max: 300, hours: 4,
    questions: [
      { question: 'Tipo de ação?', field_type: 'RADIO', options: ['Panfletagem em via pública', 'Panfletagem porta a porta', 'Promotor em loja/evento', 'Homem-placa / divulgação'], affects_price: true, price_modifier: { 'Panfletagem em via pública': 1, 'Panfletagem porta a porta': 1.3, 'Promotor em loja/evento': 1.4 }, is_required: true },
      { question: 'Duração?', field_type: 'RADIO', options: ['Meio período (4h)', 'Dia inteiro (8h)', 'Vários dias'], affects_price: true, price_modifier: { 'Meio período (4h)': 1, 'Dia inteiro (8h)': 1.8, 'Vários dias': 3.5 }, is_required: true },
      { question: 'Quantas pessoas?', field_type: 'RADIO', options: ['1', '2-3', '4+'], affects_price: true, price_modifier: { '1': 1, '2-3': 2.4, '4+': 4 }, is_required: true },
    ],
  },
  {
    group: 'negocios-escritorio', name: 'Segurança / Portaria para Eventos', slug: 'seguranca-eventos', icon: '🛡️',
    description: 'Seguranças, controle de acesso e portaria para festas e eventos', min: 150, max: 600, hours: 6,
    questions: [
      { question: 'Tipo de evento?', field_type: 'RADIO', options: ['Festa particular', 'Evento corporativo', 'Show/festival', 'Portaria de condomínio (cobertura)'], affects_price: true, price_modifier: { 'Show/festival': 1.4 }, is_required: true },
      { question: 'Quantos profissionais?', field_type: 'RADIO', options: ['1', '2-3', '4-8', 'Mais de 8'], affects_price: true, price_modifier: { '1': 1, '2-3': 2.4, '4-8': 5, 'Mais de 8': 9 }, is_required: true },
      { question: 'Duração?', field_type: 'RADIO', options: ['Até 6 horas', '6-12 horas', 'Mais de 12 horas'], affects_price: true, price_modifier: { 'Até 6 horas': 1, '6-12 horas': 1.6, 'Mais de 12 horas': 2.2 }, is_required: true },
      { question: 'Público estimado?', field_type: 'SELECT', options: ['Até 50', '50-200', '200-500', 'Acima de 500'], affects_price: false, is_required: true },
    ],
  },
  {
    group: 'negocios-escritorio', name: 'Despachante / Documentos', slug: 'despachante-documentos', icon: '📄',
    description: 'Documentação de veículos, CNH, certidões e burocracias', min: 100, max: 600, hours: 4,
    questions: [
      { question: 'Qual serviço?', field_type: 'SELECT', options: ['Transferência de veículo', 'Licenciamento/IPVA', 'CNH (renovação, PPD)', 'Certidões e registros', 'Regularização de multas/pendências', 'Outro'], affects_price: true, price_modifier: { 'Transferência de veículo': 1.3, 'Regularização de multas/pendências': 1.4 }, is_required: true },
      { question: 'É urgente?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.4, 'false': 1 }, is_required: true },
      { question: 'Descreva a situação', field_type: 'TEXTAREA', is_required: true },
    ],
  },
  {
    group: 'negocios-escritorio', name: 'Consultoria Financeira Pessoal', slug: 'consultoria-financeira', icon: '💰',
    description: 'Organização financeira, saída de dívidas e planejamento', min: 150, max: 800, hours: 3,
    questions: [
      { question: 'Qual objetivo?', field_type: 'SELECT', options: ['Organizar orçamento familiar', 'Sair das dívidas', 'Começar a investir', 'Planejamento de aposentadoria', 'Finanças do meu negócio'], affects_price: true, price_modifier: { 'Sair das dívidas': 1.2, 'Finanças do meu negócio': 1.5 }, is_required: true },
      { question: 'Formato?', field_type: 'RADIO', options: ['Encontro único (diagnóstico)', 'Acompanhamento mensal', 'Pacote 3 meses'], affects_price: true, price_modifier: { 'Encontro único (diagnóstico)': 1, 'Acompanhamento mensal': 1.6, 'Pacote 3 meses': 3.5 }, is_required: true },
      { question: 'Presencial ou online?', field_type: 'RADIO', options: ['Presencial', 'Online', 'Tanto faz'], affects_price: false, is_required: true },
    ],
  },

  // ════════════ 🧵 MODA E COSTURA ════════════
  {
    group: 'moda-costura', name: 'Costureira / Ajustes de Roupa', slug: 'costureira-ajustes', icon: '🧵',
    description: 'Barras, ajustes, reformas de roupas e costura sob medida', min: 30, max: 300, hours: 2,
    questions: [
      { question: 'Qual serviço?', field_type: 'SELECT', options: ['Barra de calça/vestido', 'Ajuste de cintura/lateral', 'Troca de zíper', 'Reforma de peça', 'Roupa sob medida', 'Vestido de festa (ajuste)'], affects_price: true, price_modifier: { 'Barra de calça/vestido': 0.5, 'Ajuste de cintura/lateral': 0.8, 'Troca de zíper': 0.6, 'Reforma de peça': 1.2, 'Roupa sob medida': 3, 'Vestido de festa (ajuste)': 1.5 }, is_required: true },
      { question: 'Quantas peças?', field_type: 'RADIO', options: ['1', '2-4', '5+'], affects_price: true, price_modifier: { '1': 1, '2-4': 2.2, '5+': 4 }, is_required: true },
      { question: 'Como prefere?', field_type: 'RADIO', options: ['Levo até a costureira', 'Retirada e entrega'], affects_price: true, price_modifier: { 'Levo até a costureira': 1, 'Retirada e entrega': 1.2 }, is_required: true },
      { question: 'Foto da peça', field_type: 'PHOTO', is_required: false },
    ],
  },
  {
    group: 'moda-costura', name: 'Conserto de Sapatos e Bolsas', slug: 'conserto-sapatos-bolsas', icon: '👞',
    description: 'Sapataria: solas, saltos, costuras, zíperes e tingimento', min: 30, max: 200, hours: 2,
    questions: [
      { question: 'Qual serviço?', field_type: 'SELECT', options: ['Troca de sola/salto', 'Costura de sapato/tênis', 'Conserto de bolsa (alça, zíper, forro)', 'Tingimento', 'Limpeza profunda de couro'], affects_price: true, price_modifier: { 'Troca de sola/salto': 1, 'Conserto de bolsa (alça, zíper, forro)': 1.1, 'Tingimento': 1.3, 'Limpeza profunda de couro': 1.2 }, is_required: true },
      { question: 'Quantos itens?', field_type: 'RADIO', options: ['1 par/item', '2-3 itens', '4+'], affects_price: true, price_modifier: { '1 par/item': 1, '2-3 itens': 1.9, '4+': 3 }, is_required: true },
      { question: 'Foto do item', field_type: 'PHOTO', is_required: true },
    ],
  },
  {
    group: 'moda-costura', name: 'Tapeçaria / Reforma de Estofados', slug: 'tapecaria-estofados', icon: '🛋️',
    description: 'Reforma de sofás, cadeiras e estofados com troca de tecido e espuma', min: 200, max: 2000, hours: 16,
    questions: [
      { question: 'Qual móvel?', field_type: 'SELECT', options: ['Sofá 2 lugares', 'Sofá 3+ lugares', 'Poltrona', 'Cadeiras (jogo)', 'Cabeceira de cama', 'Banco de carro'], affects_price: true, price_modifier: { 'Sofá 2 lugares': 1, 'Sofá 3+ lugares': 1.5, 'Poltrona': 0.6, 'Cadeiras (jogo)': 0.8, 'Cabeceira de cama': 0.7, 'Banco de carro': 1.2 }, is_required: true },
      { question: 'Tipo de reforma?', field_type: 'RADIO', options: ['Troca de tecido', 'Troca de espuma', 'Tecido + espuma', 'Estrutura + completa'], affects_price: true, price_modifier: { 'Troca de tecido': 1, 'Troca de espuma': 0.8, 'Tecido + espuma': 1.5, 'Estrutura + completa': 2 }, is_required: true },
      { question: 'O tecido novo já está comprado?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.4 }, is_required: true },
      { question: 'Foto do móvel', field_type: 'PHOTO', is_required: true },
    ],
  },
  {
    group: 'moda-costura', name: 'Personal Stylist / Imagem', slug: 'personal-stylist', icon: '👗',
    description: 'Consultoria de estilo, coloração pessoal e closet detox', min: 150, max: 800, hours: 3,
    questions: [
      { question: 'Qual serviço?', field_type: 'SELECT', options: ['Análise de coloração pessoal', 'Consultoria de estilo completa', 'Closet detox (organizar guarda-roupa)', 'Personal shopper (compras)', 'Look para evento'], affects_price: true, price_modifier: { 'Análise de coloração pessoal': 1, 'Consultoria de estilo completa': 2, 'Closet detox (organizar guarda-roupa)': 1.2, 'Personal shopper (compras)': 1.4, 'Look para evento': 0.8 }, is_required: true },
      { question: 'Formato?', field_type: 'RADIO', options: ['Presencial', 'Online'], affects_price: true, price_modifier: { 'Presencial': 1.2, 'Online': 1 }, is_required: true },
      { question: 'Qual seu objetivo com a consultoria?', field_type: 'TEXTAREA', is_required: true },
    ],
  },
  {
    group: 'moda-costura', name: 'Lavagem de Tênis', slug: 'lavagem-tenis', icon: '👟',
    description: 'Higienização, limpeza profunda e restauração de tênis', min: 40, max: 150, hours: 1,
    questions: [
      { question: 'Tipo de serviço?', field_type: 'RADIO', options: ['Limpeza simples', 'Limpeza profunda + palmilha', 'Restauração (pintura, entressola)', 'Impermeabilização'], affects_price: true, price_modifier: { 'Limpeza simples': 1, 'Limpeza profunda + palmilha': 1.4, 'Restauração (pintura, entressola)': 2.5, 'Impermeabilização': 1.2 }, is_required: true },
      { question: 'Quantos pares?', field_type: 'RADIO', options: ['1', '2-3', '4+'], affects_price: true, price_modifier: { '1': 1, '2-3': 1.9, '4+': 3.2 }, is_required: true },
      { question: 'Com retirada e entrega?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
      { question: 'Foto do tênis', field_type: 'PHOTO', is_required: false },
    ],
  },
]

// ────────────────────────────────────────────────────────────────
export async function seedRemap2(prisma: PrismaClient) {
  console.log('🗺️  Remap 2.0: reorganizando grupos e expandindo catálogo...')

  // 1. Grupos: cria os novos e atualiza nome/ícone/ordem dos existentes
  for (const g of GRUPOS) {
    await prisma.serviceGroup.upsert({
      where: { slug: g.slug },
      update: { name: g.name, icon: g.icon, order: g.order, is_active: true },
      create: { name: g.name, slug: g.slug, icon: g.icon, order: g.order },
    })
  }

  // 2. Aposenta "Serviços Gerais" (não deleta — categorias já foram movidas)
  await prisma.serviceGroup.updateMany({
    where: { slug: 'servicos-gerais' },
    data: { is_active: false, order: 99 },
  })

  const grupos = await prisma.serviceGroup.findMany({ select: { id: true, slug: true } })
  const groupId = Object.fromEntries(grupos.map((g) => [g.slug, g.id]))

  // 3. Move categorias existentes para os novos grupos (slug preservado)
  for (const [groupSlug, categorySlugs] of Object.entries(MOVIMENTOS)) {
    await prisma.category.updateMany({
      where: { slug: { in: categorySlugs } },
      data: { group_id: groupId[groupSlug] },
    })
  }
  console.log('✅ Remap 2.0: taxonomia de 17 grupos aplicada')

  // 4. Cria as categorias novas + questionários
  let criadas = 0
  for (const cat of CATALOGO) {
    const gid = groupId[cat.group]
    if (!gid) {
      console.warn(`⚠️  Remap 2.0: grupo "${cat.group}" não encontrado — pulando ${cat.slug}`)
      continue
    }
    const registro = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { group_id: gid },
      create: {
        group_id: gid,
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        description: cat.description,
        base_price_min: cat.min,
        base_price_max: cat.max,
        estimated_hours: cat.hours,
        requires_photos: false,
      },
    })

    await syncQuestionnaire(prisma, registro.id, cat.slug, cat.questions)
    criadas++
  }

  console.log(`✅ Remap 2.0: ${criadas} categorias novas garantidas no catálogo`)
}

// Execução avulsa: `npx ts-node prisma/seed-remap2.ts`
if (require.main === module) {
  const prisma = new PrismaClient()
  seedRemap2(prisma)
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())
}
