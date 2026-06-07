// ============================================================
// ARQUÉTIPOS DE QUESTIONÁRIO — fontes pesquisadas (Trice Brasil,
// Cronoshare, Engehall, TáContratado, Reforma & Construa).
// Cada arquétipo define um conjunto de campos com keys estáveis +
// uma fórmula padrão. Categorias específicas podem sobrescrever
// `pricing_formula` no seed.
// ============================================================

export type FieldType = 'TEXT' | 'TEXTAREA' | 'SELECT' | 'RADIO' | 'BOOLEAN' | 'PHOTO' | 'NUMBER' | 'DATE'

export interface ArchetypeField {
  key: string
  question: string
  field_type: FieldType
  options?: string[]
  is_required?: boolean
  affects_price?: boolean
  pricing_effect?: any
  help_text?: string
  placeholder?: string
}

export interface Archetype {
  name: string
  pricing_unit: string
  pricing_formula: any
  fields: ArchetypeField[]
}

// ------------------------------------------------------------
// REPAIR — reparos residenciais (eletricista, encanador, chaveiro)
// ------------------------------------------------------------
export const ARCHETYPE_REPAIR: Archetype = {
  name: 'REPAIR',
  pricing_unit: 'serviço',
  pricing_formula: {
    method: 'TIERED',
    pricing_unit: 'serviço',
    min_charge: 120,
    tiers: [
      { match_field: 'tipo_servico', value: 'visita_tecnica',
        label: 'Visita técnica', method: 'FIXED',
        min: 80, max: 150 },
      { match_field: 'tipo_servico', value: 'reparo_pontual',
        label: 'Reparo pontual', method: 'FIXED',
        min: 120, max: 350 },
      { match_field: 'tipo_servico', value: 'instalacao',
        label: 'Instalação por ponto', method: 'PER_UNIT',
        unit_field: 'quantidade', base_rate_min: 45, base_rate_max: 130 },
      { match_field: 'tipo_servico', value: 'reparo_urgente',
        label: 'Reparo urgente', method: 'HOURLY',
        unit_field: 'horas_estimadas', base_rate_min: 120, base_rate_max: 200 },
    ],
  },
  fields: [
    {
      key: 'tipo_servico',
      question: 'Que tipo de serviço você precisa?',
      field_type: 'RADIO',
      options: ['visita_tecnica', 'reparo_pontual', 'instalacao', 'reparo_urgente'],
      affects_price: true,
    },
    {
      key: 'quantidade',
      question: 'Quantos pontos/peças? (se aplicável)',
      field_type: 'NUMBER',
      placeholder: '1',
      is_required: false,
      affects_price: true,
      pricing_effect: { type: 'UNIT_QUANTITY' },
    },
    {
      key: 'horas_estimadas',
      question: 'Horas estimadas (se urgente)',
      field_type: 'NUMBER',
      is_required: false,
      affects_price: true,
      pricing_effect: { type: 'UNIT_QUANTITY' },
    },
    {
      key: 'fornece_material',
      question: 'Você fornece o material?',
      field_type: 'BOOLEAN',
      affects_price: true,
      pricing_effect: { type: 'SURCHARGE', if_false: { kind: 'PERCENT', pct: 0.20 } },
      help_text: 'Se o profissional precisar comprar, o orçamento aumenta.',
    },
    {
      key: 'descricao_problema',
      question: 'Descreva o problema',
      field_type: 'TEXTAREA',
      placeholder: 'Ex: tomada queimada na cozinha após queda de luz',
      is_required: true,
    },
  ],
}

// ------------------------------------------------------------
// AREA_CLEANING — diarista / faxina / limpeza pós-obra
// Fontes: Trice (R$ 25–50/h), TáContratado (R$ 200–300 pesada)
// ------------------------------------------------------------
export const ARCHETYPE_AREA_CLEANING: Archetype = {
  name: 'AREA_CLEANING',
  pricing_unit: 'hora',
  pricing_formula: {
    method: 'HOURLY',
    pricing_unit: 'hora',
    unit_field: 'horas_estimadas',
    base_rate_min: 25,
    base_rate_max: 50,
    min_charge: 150,
  },
  fields: [
    {
      key: 'horas_estimadas',
      question: 'Tamanho do imóvel',
      field_type: 'SELECT',
      options: ['4', '6', '8', '10'],
      affects_price: true,
      pricing_effect: { type: 'UNIT_QUANTITY' },
      help_text: '4h (até 40m²) · 6h (40–80m²) · 8h (80–150m²) · 10h (>150m²)',
    },
    {
      key: 'tipo_limpeza',
      question: 'Tipo de limpeza',
      field_type: 'SELECT',
      options: ['regular', 'pesada', 'pos_obra'],
      affects_price: true,
      pricing_effect: {
        type: 'MULTIPLIER',
        options: { regular: 1.0, pesada: 1.4, pos_obra: 1.8 },
      },
    },
    {
      key: 'tipo_imovel',
      question: 'Tipo de imóvel',
      field_type: 'SELECT',
      options: ['apartamento', 'casa', 'escritorio', 'comercial'],
      is_required: false,
    },
    {
      key: 'janelas_externas',
      question: 'Incluir janelas externas?',
      field_type: 'BOOLEAN',
      affects_price: true,
      pricing_effect: { type: 'SURCHARGE', if_true: { kind: 'FIXED', amount: 50 } },
    },
    {
      key: 'fornece_produtos',
      question: 'Você fornece os produtos?',
      field_type: 'BOOLEAN',
      affects_price: true,
      pricing_effect: { type: 'SURCHARGE', if_false: { kind: 'FIXED', amount: 30 } },
    },
  ],
}

// ------------------------------------------------------------
// AREA_SERVICE — serviços por m² (pintura, corte de grama, jardinagem)
// Fontes: Trice (pintura R$ 18–25/m²), Cronoshare (grama R$ 1,5–5/m²)
// ------------------------------------------------------------
export const ARCHETYPE_AREA_SERVICE: Archetype = {
  name: 'AREA_SERVICE',
  pricing_unit: 'm²',
  pricing_formula: {
    method: 'PER_UNIT',
    pricing_unit: 'm²',
    unit_field: 'area_m2',
    base_rate_min: 15,
    base_rate_max: 25,
    min_charge: 100,
  },
  fields: [
    {
      key: 'area_m2',
      question: 'Área aproximada (m²)',
      field_type: 'NUMBER',
      placeholder: '50',
      affects_price: true,
      pricing_effect: { type: 'UNIT_QUANTITY' },
    },
    {
      key: 'estado_atual',
      question: 'Como está a condição atual?',
      field_type: 'SELECT',
      options: ['otimo', 'medio', 'ruim'],
      affects_price: true,
      pricing_effect: {
        type: 'MULTIPLIER',
        options: { otimo: 1.0, medio: 1.2, ruim: 1.5 },
      },
    },
    {
      key: 'fornece_material',
      question: 'Cliente fornece o material?',
      field_type: 'BOOLEAN',
      affects_price: true,
      pricing_effect: {
        type: 'EXTRA_PER_UNIT',
        amount_min: 5,
        amount_max: 10,
        applies_when: false,
      },
      help_text: 'Se for não, o orçamento inclui materiais.',
    },
  ],
}

// ------------------------------------------------------------
// TRANSPORT — mudanças / carretos / frete
// ------------------------------------------------------------
export const ARCHETYPE_TRANSPORT: Archetype = {
  name: 'TRANSPORT',
  pricing_unit: 'serviço',
  pricing_formula: {
    method: 'FIXED',
    pricing_unit: 'serviço',
    min: 200,
    max: 800,
    min_charge: 150,
  },
  fields: [
    {
      key: 'tipo_veiculo',
      question: 'Tamanho de veículo necessário',
      field_type: 'SELECT',
      options: ['fiorino', 'hr', 'bau_3_4', 'bau_grande'],
      affects_price: true,
      pricing_effect: {
        type: 'MULTIPLIER',
        options: { fiorino: 0.7, hr: 1.0, bau_3_4: 1.4, bau_grande: 1.9 },
      },
    },
    {
      key: 'origem',
      question: 'Endereço de origem',
      field_type: 'TEXT',
      is_required: true,
    },
    {
      key: 'destino',
      question: 'Endereço de destino',
      field_type: 'TEXT',
      is_required: true,
    },
    {
      key: 'andar_origem',
      question: 'Andar na origem (sem elevador conta extra)',
      field_type: 'NUMBER',
      placeholder: '0',
    },
    {
      key: 'andar_destino',
      question: 'Andar no destino',
      field_type: 'NUMBER',
      placeholder: '0',
    },
    {
      key: 'tem_elevador',
      question: 'Tem elevador em ambos os locais?',
      field_type: 'BOOLEAN',
      affects_price: true,
      pricing_effect: { type: 'SURCHARGE', if_false: { kind: 'PERCENT', pct: 0.20 } },
    },
    {
      key: 'inclui_montagem',
      question: 'Inclui desmontagem/montagem de móveis?',
      field_type: 'BOOLEAN',
      affects_price: true,
      pricing_effect: { type: 'SURCHARGE', if_true: { kind: 'FIXED', amount: 150 } },
    },
  ],
}

// ------------------------------------------------------------
// LESSON — aulas particulares
// ------------------------------------------------------------
export const ARCHETYPE_LESSON: Archetype = {
  name: 'LESSON',
  pricing_unit: 'aula',
  pricing_formula: {
    method: 'PER_UNIT',
    pricing_unit: 'aula',
    unit_field: 'aulas_por_mes',
    base_rate_min: 60,
    base_rate_max: 120,
    min_charge: 60,
  },
  fields: [
    {
      key: 'modalidade',
      question: 'Modalidade preferida',
      field_type: 'SELECT',
      options: ['online', 'presencial', 'hibrido'],
      affects_price: true,
      pricing_effect: {
        type: 'MULTIPLIER',
        options: { online: 0.8, hibrido: 1.0, presencial: 1.2 },
      },
    },
    {
      key: 'nivel',
      question: 'Nível atual do aluno',
      field_type: 'SELECT',
      options: ['iniciante', 'intermediario', 'avancado'],
      affects_price: true,
      pricing_effect: {
        type: 'MULTIPLIER',
        options: { iniciante: 0.9, intermediario: 1.0, avancado: 1.3 },
      },
    },
    {
      key: 'aulas_por_mes',
      question: 'Aulas por mês',
      field_type: 'NUMBER',
      placeholder: '4',
      affects_price: true,
      pricing_effect: { type: 'UNIT_QUANTITY' },
    },
    {
      key: 'duracao_min',
      question: 'Duração de cada aula (min)',
      field_type: 'SELECT',
      options: ['45', '60', '90', '120'],
    },
  ],
}

// ------------------------------------------------------------
// EVENT — eventos (buffet, dj, decoração)
// ------------------------------------------------------------
export const ARCHETYPE_EVENT: Archetype = {
  name: 'EVENT',
  pricing_unit: 'evento',
  pricing_formula: {
    method: 'PER_UNIT',
    pricing_unit: 'pessoa',
    unit_field: 'num_convidados',
    base_rate_min: 35,
    base_rate_max: 90,
    min_charge: 800,
  },
  fields: [
    {
      key: 'num_convidados',
      question: 'Número de convidados',
      field_type: 'NUMBER',
      placeholder: '50',
      affects_price: true,
      pricing_effect: { type: 'UNIT_QUANTITY' },
    },
    {
      key: 'tipo_evento',
      question: 'Tipo de evento',
      field_type: 'SELECT',
      options: ['aniversario', 'casamento', 'corporativo', 'infantil', 'outro'],
      affects_price: true,
      pricing_effect: {
        type: 'MULTIPLIER',
        options: { aniversario: 1.0, casamento: 1.4, corporativo: 1.3, infantil: 0.9, outro: 1.0 },
      },
    },
    {
      key: 'duracao_horas',
      question: 'Duração (horas)',
      field_type: 'NUMBER',
      placeholder: '4',
    },
    {
      key: 'data_evento',
      question: 'Data do evento',
      field_type: 'DATE',
    },
    {
      key: 'fim_de_semana',
      question: 'Evento em fim de semana?',
      field_type: 'BOOLEAN',
      affects_price: true,
      pricing_effect: { type: 'SURCHARGE', if_true: { kind: 'PERCENT', pct: 0.15 } },
    },
  ],
}

// ------------------------------------------------------------
// HEALTH_BEAUTY — saúde/beleza em domicílio
// ------------------------------------------------------------
export const ARCHETYPE_HEALTH_BEAUTY: Archetype = {
  name: 'HEALTH_BEAUTY',
  pricing_unit: 'sessão',
  pricing_formula: {
    method: 'PER_UNIT',
    pricing_unit: 'sessão',
    unit_field: 'sessoes',
    base_rate_min: 80,
    base_rate_max: 200,
    min_charge: 80,
  },
  fields: [
    {
      key: 'sessoes',
      question: 'Quantas sessões / atendimentos?',
      field_type: 'NUMBER',
      placeholder: '1',
      affects_price: true,
      pricing_effect: { type: 'UNIT_QUANTITY' },
    },
    {
      key: 'local',
      question: 'Local do atendimento',
      field_type: 'SELECT',
      options: ['domicilio', 'profissional', 'online'],
      affects_price: true,
      pricing_effect: {
        type: 'MULTIPLIER',
        options: { domicilio: 1.3, profissional: 1.0, online: 0.7 },
      },
    },
    {
      key: 'observacoes',
      question: 'Observações ou pedidos especiais',
      field_type: 'TEXTAREA',
      is_required: false,
    },
  ],
}

// ------------------------------------------------------------
// CONSULTING — consultoria / serviço técnico (advogado, contador, design)
// ------------------------------------------------------------
export const ARCHETYPE_CONSULTING: Archetype = {
  name: 'CONSULTING',
  pricing_unit: 'projeto',
  pricing_formula: {
    method: 'TIERED',
    pricing_unit: 'projeto',
    tiers: [
      { match_field: 'escopo', value: 'pontual',
        label: 'Atendimento pontual', method: 'FIXED', min: 150, max: 400 },
      { match_field: 'escopo', value: 'projeto',
        label: 'Projeto', method: 'FIXED', min: 600, max: 3500 },
      { match_field: 'escopo', value: 'recorrente',
        label: 'Mensal', method: 'FIXED', min: 800, max: 3000 },
    ],
  },
  fields: [
    {
      key: 'escopo',
      question: 'Tipo de demanda',
      field_type: 'RADIO',
      options: ['pontual', 'projeto', 'recorrente'],
      affects_price: true,
    },
    {
      key: 'modalidade',
      question: 'Modalidade',
      field_type: 'SELECT',
      options: ['online', 'presencial', 'hibrido'],
    },
    {
      key: 'prazo',
      question: 'Qual o prazo desejado?',
      field_type: 'SELECT',
      options: ['urgente', 'normal', 'flexivel'],
      affects_price: true,
      pricing_effect: { type: 'MULTIPLIER', options: { urgente: 1.4, normal: 1.0, flexivel: 0.9 } },
    },
    {
      key: 'descricao',
      question: 'Descreva o que você precisa',
      field_type: 'TEXTAREA',
      is_required: true,
    },
  ],
}

// ------------------------------------------------------------
// GENERIC — fallback para categorias sem arquétipo definido
// ------------------------------------------------------------
export const ARCHETYPE_GENERIC: Archetype = {
  name: 'GENERIC',
  pricing_unit: 'serviço',
  pricing_formula: {
    method: 'FIXED',
    pricing_unit: 'serviço',
    min: 80,
    max: 400,
    min_charge: 80,
  },
  fields: [
    {
      key: 'descricao',
      question: 'Descreva o serviço',
      field_type: 'TEXTAREA',
      is_required: true,
      placeholder: 'Conte o que você precisa em detalhes',
    },
    {
      key: 'urgencia',
      question: 'Urgência',
      field_type: 'SELECT',
      options: ['normal', 'esta_semana', 'hoje'],
      affects_price: true,
      pricing_effect: { type: 'MULTIPLIER', options: { normal: 1.0, esta_semana: 1.1, hoje: 1.3 } },
    },
  ],
}

export const ARCHETYPES: Record<string, Archetype> = {
  REPAIR: ARCHETYPE_REPAIR,
  AREA_CLEANING: ARCHETYPE_AREA_CLEANING,
  AREA_SERVICE: ARCHETYPE_AREA_SERVICE,
  TRANSPORT: ARCHETYPE_TRANSPORT,
  LESSON: ARCHETYPE_LESSON,
  EVENT: ARCHETYPE_EVENT,
  HEALTH_BEAUTY: ARCHETYPE_HEALTH_BEAUTY,
  CONSULTING: ARCHETYPE_CONSULTING,
  GENERIC: ARCHETYPE_GENERIC,
}
