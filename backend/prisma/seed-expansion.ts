// ============================================================
// SEED DE EXPANSÃO — categorias GetNinjas + precificação dinâmica
// ============================================================
// Roda DEPOIS do seed.ts existente.
// É idempotente: upsert nos grupos e categorias por slug.
// Cria/atualiza os arquétipos e calibra as 10 categorias top
// com pricing_formula específico.
// ============================================================

import { PrismaClient, FieldType } from '@prisma/client'
import { ARCHETYPES, Archetype } from './seed-archetypes'

const prisma = new PrismaClient()

// ------------------------------------------------------------
// GRUPOS GETNINJAS (mantém slugs em PT-BR)
// ------------------------------------------------------------
const GROUPS: Array<{ slug: string; name: string; icon: string; order: number }> = [
  { slug: 'reformas-reparos', name: 'Reformas e Reparos', icon: '🔧', order: 20 },
  { slug: 'assistencia-tecnica', name: 'Assistência Técnica', icon: '🛠️', order: 21 },
  { slug: 'aulas-particulares', name: 'Aulas Particulares', icon: '📚', order: 22 },
  { slug: 'servicos-domesticos-pets', name: 'Serviços Domésticos e Pets', icon: '🏠', order: 23 },
  { slug: 'moda-beleza', name: 'Moda e Beleza', icon: '💄', order: 24 },
  { slug: 'eventos', name: 'Eventos', icon: '🎉', order: 25 },
  { slug: 'automoveis', name: 'Automóveis', icon: '🚗', order: 26 },
  { slug: 'saude', name: 'Saúde', icon: '⚕️', order: 27 },
  { slug: 'consultoria', name: 'Consultoria', icon: '💼', order: 28 },
  { slug: 'design-tecnologia', name: 'Design e Tecnologia', icon: '💻', order: 29 },
]

interface CategorySpec {
  slug: string
  name: string
  icon: string
  archetype: keyof typeof ARCHETYPES
  // overrides opcionais
  base_price_min?: number
  base_price_max?: number
  pricing_formula?: any
  pricing_unit?: string
}

// ------------------------------------------------------------
// CATEGORIAS POR GRUPO (lista derivada do GetNinjas)
// ------------------------------------------------------------
const CATEGORIES: Record<string, CategorySpec[]> = {
  'reformas-reparos': [
    { slug: 'gn-eletricista', name: 'Eletricista', icon: '⚡', archetype: 'REPAIR',
      base_price_min: 80, base_price_max: 400 },
    { slug: 'gn-encanador', name: 'Encanador', icon: '🔧', archetype: 'REPAIR',
      base_price_min: 80, base_price_max: 350 },
    { slug: 'gn-pedreiro', name: 'Pedreiro', icon: '🧱', archetype: 'REPAIR',
      base_price_min: 200, base_price_max: 1500 },
    { slug: 'gn-pintor', name: 'Pintor', icon: '🎨', archetype: 'AREA_SERVICE',
      pricing_formula: { method: 'PER_UNIT', pricing_unit: 'm²', unit_field: 'area_m2',
        base_rate_min: 18, base_rate_max: 25, min_charge: 250 },
      pricing_unit: 'm²' },
    { slug: 'gn-marceneiro', name: 'Marceneiro', icon: '🪚', archetype: 'REPAIR',
      base_price_min: 150, base_price_max: 800 },
    { slug: 'gn-montagem-moveis', name: 'Montador de Móveis', icon: '🪑', archetype: 'REPAIR',
      base_price_min: 100, base_price_max: 400 },
    { slug: 'gn-mudancas-carretos', name: 'Mudanças e Carretos', icon: '🚚', archetype: 'TRANSPORT' },
    { slug: 'gn-marido-aluguel', name: 'Marido de Aluguel', icon: '🧰', archetype: 'REPAIR',
      base_price_min: 100, base_price_max: 400 },
    { slug: 'gn-vidraceiro', name: 'Vidraceiro', icon: '🪟', archetype: 'REPAIR' },
    { slug: 'gn-chaveiro', name: 'Chaveiro', icon: '🔑', archetype: 'REPAIR',
      base_price_min: 80, base_price_max: 250 },
    { slug: 'gn-jardinagem', name: 'Jardinagem', icon: '🌳', archetype: 'AREA_SERVICE',
      pricing_formula: { method: 'PER_UNIT', pricing_unit: 'm²', unit_field: 'area_m2',
        base_rate_min: 2, base_rate_max: 6, min_charge: 120 },
      pricing_unit: 'm²' },
    { slug: 'gn-corte-grama', name: 'Corte de Grama', icon: '🌱', archetype: 'AREA_SERVICE',
      pricing_formula: { method: 'PER_UNIT', pricing_unit: 'm²', unit_field: 'area_m2',
        base_rate_min: 1.5, base_rate_max: 5.0, min_charge: 80 },
      pricing_unit: 'm²' },
    { slug: 'gn-limpeza-pos-obra', name: 'Limpeza Pós-Obra', icon: '🧹', archetype: 'AREA_CLEANING',
      pricing_formula: { method: 'HOURLY', pricing_unit: 'hora', unit_field: 'horas_estimadas',
        base_rate_min: 40, base_rate_max: 75, min_charge: 300 },
      pricing_unit: 'hora' },
    { slug: 'gn-limpeza-vidros', name: 'Limpeza de Vidros', icon: '🪟', archetype: 'AREA_CLEANING' },
    { slug: 'gn-tapeceiro', name: 'Tapeceiro', icon: '🛋️', archetype: 'REPAIR' },
    { slug: 'gn-serralheria', name: 'Serralheria e Solda', icon: '🔨', archetype: 'REPAIR' },
    { slug: 'gn-gesso-drywall', name: 'Gesso e DryWall', icon: '🏗️', archetype: 'AREA_SERVICE' },
    { slug: 'gn-paisagista', name: 'Paisagista', icon: '🌺', archetype: 'CONSULTING' },
    { slug: 'gn-arquiteto', name: 'Arquiteto', icon: '📐', archetype: 'CONSULTING' },
    { slug: 'gn-engenheiro', name: 'Engenheiro', icon: '👷', archetype: 'CONSULTING' },
    { slug: 'gn-design-interiores', name: 'Design de Interiores', icon: '🛋️', archetype: 'CONSULTING' },
    { slug: 'gn-decorador', name: 'Decorador', icon: '🖼️', archetype: 'CONSULTING' },
    { slug: 'gn-dedetizador', name: 'Dedetizador', icon: '🪲', archetype: 'AREA_SERVICE' },
    { slug: 'gn-desentupidor', name: 'Desentupidor', icon: '🚽', archetype: 'REPAIR' },
    { slug: 'gn-piscina', name: 'Piscina (manutenção)', icon: '🏊', archetype: 'REPAIR' },
    { slug: 'gn-impermeabilizador', name: 'Impermeabilizador', icon: '💧', archetype: 'AREA_SERVICE' },
    { slug: 'gn-marmoraria', name: 'Marmoraria e Granitos', icon: '🪨', archetype: 'REPAIR' },
    { slug: 'gn-portao-automatico', name: 'Portão Automático', icon: '🚪', archetype: 'REPAIR' },
    { slug: 'gn-energia-solar', name: 'Energia Solar', icon: '☀️', archetype: 'CONSULTING' },
    { slug: 'gn-automacao-residencial', name: 'Automação Residencial', icon: '🏠', archetype: 'CONSULTING' },
    { slug: 'gn-climatizacao', name: 'Climatização', icon: '❄️', archetype: 'REPAIR' },
    { slug: 'gn-toldos-coberturas', name: 'Toldos e Coberturas', icon: '⛱️', archetype: 'REPAIR' },
    { slug: 'gn-redes-protecao', name: 'Redes de Proteção', icon: '🕸️', archetype: 'AREA_SERVICE' },
    { slug: 'gn-papel-parede', name: 'Instalação de Papel de Parede', icon: '📜', archetype: 'AREA_SERVICE' },
    { slug: 'gn-restauracao-pisos', name: 'Restauração de Pisos', icon: '🪵', archetype: 'AREA_SERVICE' },
    { slug: 'gn-sonorizacao', name: 'Sonorização de Ambientes', icon: '🔊', archetype: 'REPAIR' },
    { slug: 'gn-seguranca-eletronica', name: 'Segurança Eletrônica', icon: '📹', archetype: 'REPAIR' },
    { slug: 'gn-antenista', name: 'Antenista', icon: '📡', archetype: 'REPAIR' },
    { slug: 'gn-coifas', name: 'Coifas e Exaustores', icon: '🍳', archetype: 'REPAIR' },
    { slug: 'gn-fossa', name: 'Fossa', icon: '🚧', archetype: 'REPAIR' },
    { slug: 'gn-gas', name: 'Gás (instalação)', icon: '🔥', archetype: 'REPAIR' },
    { slug: 'gn-poco-artesiano', name: 'Poço Artesiano', icon: '💧', archetype: 'CONSULTING' },
    { slug: 'gn-demolicao', name: 'Demolição', icon: '🔨', archetype: 'REPAIR' },
    { slug: 'gn-pavimentacao', name: 'Pavimentação', icon: '🛣️', archetype: 'AREA_SERVICE' },
    { slug: 'gn-remocao-entulho', name: 'Remoção de Entulho', icon: '🗑️', archetype: 'TRANSPORT' },
    { slug: 'gn-empreiteiro', name: 'Empreiteiro', icon: '👷', archetype: 'CONSULTING' },
    { slug: 'gn-banheira', name: 'Banheira (instalação)', icon: '🛁', archetype: 'REPAIR' },
    { slug: 'gn-instalacao-eletronicos', name: 'Instalação de Eletrônicos', icon: '📺', archetype: 'REPAIR' },
    { slug: 'gn-isolamento', name: 'Isolamento Térmico/Acústico', icon: '🧱', archetype: 'AREA_SERVICE' },
  ],
  'assistencia-tecnica': [
    { slug: 'gn-at-ar-condicionado', name: 'AT — Ar Condicionado', icon: '❄️', archetype: 'REPAIR' },
    { slug: 'gn-at-eletrodomesticos', name: 'AT — Eletrodomésticos', icon: '🔌', archetype: 'REPAIR' },
    { slug: 'gn-at-geladeira', name: 'AT — Geladeira e Freezer', icon: '🧊', archetype: 'REPAIR' },
    { slug: 'gn-at-lava-roupa', name: 'AT — Lava Roupa', icon: '🧺', archetype: 'REPAIR' },
    { slug: 'gn-at-fogao', name: 'AT — Fogão e Cooktop', icon: '🍳', archetype: 'REPAIR' },
    { slug: 'gn-at-micro-ondas', name: 'AT — Micro-ondas', icon: '🍱', archetype: 'REPAIR' },
    { slug: 'gn-at-lava-louca', name: 'AT — Lava Louça', icon: '🍽️', archetype: 'REPAIR' },
    { slug: 'gn-at-secadora', name: 'AT — Secadora', icon: '🧺', archetype: 'REPAIR' },
    { slug: 'gn-at-televisao', name: 'AT — Televisão', icon: '📺', archetype: 'REPAIR' },
    { slug: 'gn-at-celular', name: 'AT — Celular', icon: '📱', archetype: 'REPAIR' },
    { slug: 'gn-at-notebook', name: 'AT — Notebook', icon: '💻', archetype: 'REPAIR' },
    { slug: 'gn-at-computador', name: 'AT — Computador Desktop', icon: '🖥️', archetype: 'REPAIR' },
    { slug: 'gn-at-impressora', name: 'AT — Impressora', icon: '🖨️', archetype: 'REPAIR' },
    { slug: 'gn-at-tablet', name: 'AT — Tablet', icon: '📱', archetype: 'REPAIR' },
    { slug: 'gn-at-camera', name: 'AT — Câmera', icon: '📷', archetype: 'REPAIR' },
    { slug: 'gn-at-cortador-grama', name: 'AT — Cortador de Grama', icon: '🌱', archetype: 'REPAIR' },
    { slug: 'gn-at-aquecedor-gas', name: 'AT — Aquecedor a Gás', icon: '🔥', archetype: 'REPAIR' },
    { slug: 'gn-at-gerador', name: 'AT — Gerador', icon: '⚡', archetype: 'REPAIR' },
    { slug: 'gn-at-relogio', name: 'AT — Relógio', icon: '⌚', archetype: 'REPAIR' },
    { slug: 'gn-at-instrumento-musical', name: 'AT — Instrumentos Musicais', icon: '🎸', archetype: 'REPAIR' },
    { slug: 'gn-at-maquina-costura', name: 'AT — Máquina de Costura', icon: '🧵', archetype: 'REPAIR' },
    { slug: 'gn-at-aparelhos-ginastica', name: 'AT — Aparelhos de Ginástica', icon: '🏋️', archetype: 'REPAIR' },
    { slug: 'gn-at-cabeamento-redes', name: 'AT — Cabeamento e Redes', icon: '🔌', archetype: 'REPAIR' },
    { slug: 'gn-at-home-theater', name: 'AT — Home Theater', icon: '🎬', archetype: 'REPAIR' },
    { slug: 'gn-at-video-game', name: 'AT — Vídeo Game', icon: '🎮', archetype: 'REPAIR' },
  ],
  'aulas-particulares': [
    { slug: 'gn-aula-ingles', name: 'Aulas de Inglês', icon: '🇬🇧', archetype: 'LESSON' },
    { slug: 'gn-aula-espanhol', name: 'Aulas de Espanhol', icon: '🇪🇸', archetype: 'LESSON' },
    { slug: 'gn-aula-frances', name: 'Aulas de Francês', icon: '🇫🇷', archetype: 'LESSON' },
    { slug: 'gn-aula-italiano', name: 'Aulas de Italiano', icon: '🇮🇹', archetype: 'LESSON' },
    { slug: 'gn-aula-alemao', name: 'Aulas de Alemão', icon: '🇩🇪', archetype: 'LESSON' },
    { slug: 'gn-aula-mandarim', name: 'Aulas de Mandarim', icon: '🇨🇳', archetype: 'LESSON' },
    { slug: 'gn-aula-japones', name: 'Aulas de Japonês', icon: '🇯🇵', archetype: 'LESSON' },
    { slug: 'gn-aula-violao', name: 'Aulas de Violão', icon: '🎸', archetype: 'LESSON' },
    { slug: 'gn-aula-piano', name: 'Aulas de Piano', icon: '🎹', archetype: 'LESSON' },
    { slug: 'gn-aula-canto', name: 'Aulas de Canto', icon: '🎤', archetype: 'LESSON' },
    { slug: 'gn-aula-bateria', name: 'Aulas de Bateria', icon: '🥁', archetype: 'LESSON' },
    { slug: 'gn-aula-violino', name: 'Aulas de Violino', icon: '🎻', archetype: 'LESSON' },
    { slug: 'gn-aula-matematica', name: 'Reforço de Matemática', icon: '➗', archetype: 'LESSON' },
    { slug: 'gn-aula-portugues', name: 'Reforço de Português', icon: '📝', archetype: 'LESSON' },
    { slug: 'gn-aula-fisica', name: 'Reforço de Física', icon: '⚛️', archetype: 'LESSON' },
    { slug: 'gn-aula-quimica', name: 'Reforço de Química', icon: '🧪', archetype: 'LESSON' },
    { slug: 'gn-aula-vestibular', name: 'Pré-Vestibular', icon: '🎓', archetype: 'LESSON' },
    { slug: 'gn-aula-concursos', name: 'Preparatório Concursos', icon: '📚', archetype: 'LESSON' },
    { slug: 'gn-aula-fotografia', name: 'Aulas de Fotografia', icon: '📸', archetype: 'LESSON' },
    { slug: 'gn-aula-danca', name: 'Aulas de Dança', icon: '💃', archetype: 'LESSON' },
    { slug: 'gn-aula-yoga', name: 'Aulas de Yoga', icon: '🧘', archetype: 'LESSON' },
    { slug: 'gn-aula-pilates', name: 'Aulas de Pilates', icon: '🤸', archetype: 'LESSON' },
    { slug: 'gn-aula-personal', name: 'Personal Trainer', icon: '💪', archetype: 'LESSON' },
    { slug: 'gn-aula-natacao', name: 'Aulas de Natação', icon: '🏊', archetype: 'LESSON' },
    { slug: 'gn-aula-tenis', name: 'Aulas de Tênis', icon: '🎾', archetype: 'LESSON' },
    { slug: 'gn-aula-futebol', name: 'Aulas de Futebol', icon: '⚽', archetype: 'LESSON' },
    { slug: 'gn-aula-boxe', name: 'Aulas de Boxe', icon: '🥊', archetype: 'LESSON' },
    { slug: 'gn-aula-jiu-jitsu', name: 'Aulas de Jiu-Jitsu', icon: '🥋', archetype: 'LESSON' },
    { slug: 'gn-aula-muay-thai', name: 'Aulas de Muay Thai', icon: '🥊', archetype: 'LESSON' },
    { slug: 'gn-aula-informatica', name: 'Aulas de Informática', icon: '💻', archetype: 'LESSON' },
    { slug: 'gn-aula-marketing-digital', name: 'Aulas de Marketing Digital', icon: '📱', archetype: 'LESSON' },
    { slug: 'gn-aula-web-dev', name: 'Aulas de Desenvolvimento Web', icon: '🌐', archetype: 'LESSON' },
    { slug: 'gn-aula-gastronomia', name: 'Aulas de Gastronomia', icon: '👨‍🍳', archetype: 'LESSON' },
    { slug: 'gn-aula-direcao', name: 'Aulas de Direção', icon: '🚗', archetype: 'LESSON' },
  ],
  'servicos-domesticos-pets': [
    { slug: 'gn-diarista', name: 'Diarista', icon: '🧹', archetype: 'AREA_CLEANING',
      pricing_formula: { method: 'HOURLY', pricing_unit: 'hora', unit_field: 'horas_estimadas',
        base_rate_min: 25, base_rate_max: 50, min_charge: 150 },
      pricing_unit: 'hora' },
    { slug: 'gn-faxineira', name: 'Faxineira', icon: '🧽', archetype: 'AREA_CLEANING' },
    { slug: 'gn-passadeira', name: 'Passadeira', icon: '👕', archetype: 'AREA_CLEANING' },
    { slug: 'gn-cozinheira', name: 'Cozinheira', icon: '👩‍🍳', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-baba', name: 'Babá', icon: '👶', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-cuidador-idosos', name: 'Cuidador de Idosos', icon: '👴', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-motorista-particular', name: 'Motorista Particular', icon: '🚙', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-personal-organizer', name: 'Personal Organizer', icon: '📦', archetype: 'CONSULTING' },
    { slug: 'gn-personal-shopper', name: 'Personal Shopper', icon: '🛍️', archetype: 'CONSULTING' },
    { slug: 'gn-lavanderia', name: 'Lavanderia', icon: '🧺', archetype: 'GENERIC' },
    { slug: 'gn-costureira', name: 'Costureira', icon: '🧵', archetype: 'GENERIC' },
    { slug: 'gn-dog-walker', name: 'Passeador de Cães (Dog Walker)', icon: '🐕', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-adestrador', name: 'Adestrador', icon: '🐶', archetype: 'LESSON' },
    { slug: 'gn-banho-tosa', name: 'Banho e Tosa', icon: '🐩', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-hospedagem-pet', name: 'Hospedagem Pet', icon: '🏨', archetype: 'GENERIC' },
    { slug: 'gn-veterinario-domiciliar', name: 'Veterinário Domiciliar', icon: '🩺', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-pet-sitter', name: 'Pet Sitter', icon: '🐈', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-limpeza-estofados', name: 'Limpeza de Estofados', icon: '🛋️', archetype: 'AREA_CLEANING' },
    { slug: 'gn-limpeza-caixa-dagua', name: 'Limpeza de Caixa d\'Água', icon: '💧', archetype: 'GENERIC' },
    { slug: 'gn-sindico-profissional', name: 'Síndico Profissional', icon: '🏢', archetype: 'CONSULTING' },
  ],
  'moda-beleza': [
    { slug: 'gn-cabeleireiro', name: 'Cabeleireiro', icon: '💇', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-barbeiro', name: 'Barbeiro', icon: '💈', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-manicure-pedicure', name: 'Manicure e Pedicure', icon: '💅', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-maquiador', name: 'Maquiador', icon: '💄', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-depilacao', name: 'Depilação', icon: '🪒', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-esteticista', name: 'Esteticista', icon: '✨', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-design-sobrancelhas', name: 'Design de Sobrancelhas', icon: '👁️', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-design-cilios', name: 'Designer de Cílios', icon: '👁️', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-micropigmentador', name: 'Micropigmentador', icon: '🖊️', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-bronzeamento', name: 'Bronzeamento', icon: '🌞', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-podologo', name: 'Podólogo', icon: '👣', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-personal-stylist', name: 'Personal Stylist', icon: '👗', archetype: 'CONSULTING' },
    { slug: 'gn-visagista', name: 'Visagista', icon: '🎨', archetype: 'CONSULTING' },
    { slug: 'gn-alfaiate', name: 'Alfaiate', icon: '🧵', archetype: 'GENERIC' },
    { slug: 'gn-sapateiro', name: 'Sapateiro', icon: '👞', archetype: 'GENERIC' },
    { slug: 'gn-ourives', name: 'Ourives', icon: '💍', archetype: 'GENERIC' },
  ],
  'eventos': [
    { slug: 'gn-buffet', name: 'Buffet Completo', icon: '🍽️', archetype: 'EVENT' },
    { slug: 'gn-churrasqueiro', name: 'Churrasqueiro', icon: '🥩', archetype: 'EVENT' },
    { slug: 'gn-personal-chef', name: 'Personal Chef', icon: '👨‍🍳', archetype: 'EVENT' },
    { slug: 'gn-confeitaria', name: 'Confeitaria', icon: '🍰', archetype: 'EVENT' },
    { slug: 'gn-chocolateiro', name: 'Chocolateiro', icon: '🍫', archetype: 'EVENT' },
    { slug: 'gn-dj', name: 'DJ', icon: '🎧', archetype: 'EVENT' },
    { slug: 'gn-banda-cantor', name: 'Bandas e Cantores', icon: '🎸', archetype: 'EVENT' },
    { slug: 'gn-bartender', name: 'Bartender', icon: '🍹', archetype: 'EVENT' },
    { slug: 'gn-garcom', name: 'Garçons e Copeiras', icon: '🍷', archetype: 'EVENT' },
    { slug: 'gn-animacao-festas', name: 'Animação de Festas', icon: '🎈', archetype: 'EVENT' },
    { slug: 'gn-decoracao-eventos', name: 'Decoração de Eventos', icon: '🎀', archetype: 'EVENT' },
    { slug: 'gn-florista', name: 'Florista', icon: '💐', archetype: 'EVENT' },
    { slug: 'gn-fotografia-eventos', name: 'Fotografia de Eventos', icon: '📷', archetype: 'EVENT' },
    { slug: 'gn-video-eventos', name: 'Gravação de Vídeos', icon: '🎥', archetype: 'EVENT' },
    { slug: 'gn-assessor-eventos', name: 'Assessor de Eventos', icon: '📋', archetype: 'CONSULTING' },
    { slug: 'gn-cerimonialista', name: 'Cerimonialista', icon: '🎙️', archetype: 'EVENT' },
    { slug: 'gn-celebrante', name: 'Celebrante', icon: '👰', archetype: 'EVENT' },
    { slug: 'gn-carros-casamento', name: 'Carros de Casamento', icon: '🚗', archetype: 'EVENT' },
    { slug: 'gn-food-truck', name: 'Food Truck', icon: '🚚', archetype: 'EVENT' },
    { slug: 'gn-seguranca-eventos', name: 'Segurança de Eventos', icon: '🛡️', archetype: 'EVENT' },
    { slug: 'gn-manobrista', name: 'Manobrista (Valet)', icon: '🅿️', archetype: 'EVENT' },
    { slug: 'gn-recepcionista', name: 'Recepcionistas', icon: '💁', archetype: 'EVENT' },
    { slug: 'gn-equipamentos-festas', name: 'Equipamentos para Festas', icon: '🎪', archetype: 'EVENT' },
    { slug: 'gn-local-eventos', name: 'Local para Eventos', icon: '🏛️', archetype: 'EVENT' },
    { slug: 'gn-brindes', name: 'Brindes e Lembrancinhas', icon: '🎁', archetype: 'EVENT' },
    { slug: 'gn-onibus-balada', name: 'Ônibus Balada', icon: '🚌', archetype: 'EVENT' },
    { slug: 'gn-sommelier', name: 'Sommelier', icon: '🍷', archetype: 'EVENT' },
  ],
  'automoveis': [
    { slug: 'gn-mecanica-geral', name: 'Mecânica Geral', icon: '🔧', archetype: 'REPAIR' },
    { slug: 'gn-auto-eletrico', name: 'Auto Elétrico', icon: '⚡', archetype: 'REPAIR' },
    { slug: 'gn-funilaria', name: 'Funilaria Automotiva', icon: '🚙', archetype: 'REPAIR' },
    { slug: 'gn-pintura-auto', name: 'Pintura Automotiva', icon: '🎨', archetype: 'REPAIR' },
    { slug: 'gn-martelinho-ouro', name: 'Martelinho de Ouro', icon: '🔨', archetype: 'REPAIR' },
    { slug: 'gn-borracharia', name: 'Borracharia', icon: '🛞', archetype: 'REPAIR' },
    { slug: 'gn-insulfilm', name: 'Insulfilm', icon: '🖤', archetype: 'REPAIR' },
    { slug: 'gn-som-automotivo', name: 'Som Automotivo', icon: '🔊', archetype: 'REPAIR' },
    { slug: 'gn-alarme-auto', name: 'Alarme Automotivo', icon: '🚨', archetype: 'REPAIR' },
    { slug: 'gn-ar-cond-auto', name: 'Ar Condicionado Automotivo', icon: '❄️', archetype: 'REPAIR' },
    { slug: 'gn-higienizacao-polimento', name: 'Higienização e Polimento', icon: '✨', archetype: 'REPAIR' },
    { slug: 'gn-vidracaria-auto', name: 'Vidraçaria Automotiva', icon: '🪟', archetype: 'REPAIR' },
    { slug: 'gn-guincho', name: 'Guincho', icon: '🚚', archetype: 'TRANSPORT' },
  ],
  'saude': [
    { slug: 'gn-fisioterapeuta', name: 'Fisioterapeuta', icon: '🩻', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-nutricionista', name: 'Nutricionista', icon: '🥗', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-psicologo', name: 'Psicólogo', icon: '🧠', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-psicanalista', name: 'Psicanalista', icon: '🧠', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-dentista', name: 'Dentista', icon: '🦷', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-medico', name: 'Médico', icon: '👨‍⚕️', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-enfermeira', name: 'Enfermeira', icon: '👩‍⚕️', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-fonoaudiologo', name: 'Fonoaudiólogo', icon: '🗣️', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-terapia-ocupacional', name: 'Terapia Ocupacional', icon: '🤝', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-doula', name: 'Doula', icon: '🤰', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-coach', name: 'Coach', icon: '🎯', archetype: 'CONSULTING' },
    { slug: 'gn-biomedicina-estetica', name: 'Biomedicina Estética', icon: '💉', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-hipnoterapia', name: 'Hipnoterapia', icon: '🌀', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-quiropraxia', name: 'Quiropraxia', icon: '💆', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-remocao-tatuagem', name: 'Remoção de Tatuagem', icon: '🩹', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-terapias-alternativas', name: 'Terapias Alternativas', icon: '🌿', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-cuidador-pessoas', name: 'Cuidador de Pessoas', icon: '🤝', archetype: 'HEALTH_BEAUTY' },
    { slug: 'gn-aconselhamento-conjugal', name: 'Aconselhamento Conjugal', icon: '💑', archetype: 'CONSULTING' },
  ],
  'consultoria': [
    { slug: 'gn-advogado', name: 'Advogado', icon: '⚖️', archetype: 'CONSULTING' },
    { slug: 'gn-contador', name: 'Contador', icon: '🧮', archetype: 'CONSULTING' },
    { slug: 'gn-assessor-investimentos', name: 'Assessor de Investimentos', icon: '📈', archetype: 'CONSULTING' },
    { slug: 'gn-despachante', name: 'Despachante', icon: '📋', archetype: 'CONSULTING' },
    { slug: 'gn-corretor', name: 'Corretor de Imóveis', icon: '🏘️', archetype: 'CONSULTING' },
    { slug: 'gn-administracao-condominios', name: 'Adm. de Condomínios', icon: '🏢', archetype: 'CONSULTING' },
    { slug: 'gn-administracao-imoveis', name: 'Adm. de Imóveis', icon: '🏠', archetype: 'CONSULTING' },
    { slug: 'gn-recrutamento', name: 'Recrutamento e Seleção', icon: '👥', archetype: 'CONSULTING' },
    { slug: 'gn-traducao', name: 'Tradução', icon: '🌍', archetype: 'CONSULTING' },
    { slug: 'gn-traducao-juramentada', name: 'Tradução Juramentada', icon: '📜', archetype: 'CONSULTING' },
    { slug: 'gn-assessoria-imprensa', name: 'Assessoria de Imprensa', icon: '📰', archetype: 'CONSULTING' },
    { slug: 'gn-auditoria', name: 'Auditoria', icon: '🔍', archetype: 'CONSULTING' },
    { slug: 'gn-seguranca-trabalho', name: 'Segurança do Trabalho', icon: '🦺', archetype: 'CONSULTING' },
    { slug: 'gn-detetive-particular', name: 'Detetive Particular', icon: '🕵️', archetype: 'CONSULTING' },
    { slug: 'gn-guia-turismo', name: 'Guia de Turismo', icon: '🗺️', archetype: 'CONSULTING' },
    { slug: 'gn-mediacao-conflitos', name: 'Mediação de Conflitos', icon: '🤝', archetype: 'CONSULTING' },
    { slug: 'gn-palestrante', name: 'Palestrante', icon: '🎤', archetype: 'CONSULTING' },
    { slug: 'gn-treinamentos', name: 'Treinamentos Corporativos', icon: '🎓', archetype: 'CONSULTING' },
    { slug: 'gn-escrita-conteudo', name: 'Escrita e Conteúdo', icon: '✍️', archetype: 'CONSULTING' },
    { slug: 'gn-consultor-pessoal', name: 'Consultor Pessoal', icon: '🤵', archetype: 'CONSULTING' },
    { slug: 'gn-economia-financas', name: 'Consultoria Financeira', icon: '💰', archetype: 'CONSULTING' },
    { slug: 'gn-testamento-patrimonio', name: 'Testamento e Patrimônio', icon: '📑', archetype: 'CONSULTING' },
    { slug: 'gn-digitacao', name: 'Digitação de Documentos', icon: '⌨️', archetype: 'GENERIC' },
  ],
  'design-tecnologia': [
    { slug: 'gn-criacao-logos', name: 'Criação de Logos', icon: '🎨', archetype: 'CONSULTING' },
    { slug: 'gn-criacao-marca', name: 'Criação de Marca', icon: '🏷️', archetype: 'CONSULTING' },
    { slug: 'gn-desenvolvimento-sites', name: 'Desenvolvimento de Sites', icon: '🌐', archetype: 'CONSULTING' },
    { slug: 'gn-desenvolvimento-apps', name: 'Desenvolvimento de Aplicativos', icon: '📱', archetype: 'CONSULTING' },
    { slug: 'gn-desenvolvimento-games', name: 'Desenvolvimento de Games', icon: '🎮', archetype: 'CONSULTING' },
    { slug: 'gn-ux-ui', name: 'UX/UI Design', icon: '🎨', archetype: 'CONSULTING' },
    { slug: 'gn-web-design', name: 'Web Design', icon: '🌐', archetype: 'CONSULTING' },
    { slug: 'gn-marketing-online', name: 'Marketing Online', icon: '📊', archetype: 'CONSULTING' },
    { slug: 'gn-animacao', name: 'Animação', icon: '🎬', archetype: 'CONSULTING' },
    { slug: 'gn-ilustracao', name: 'Ilustração', icon: '🖌️', archetype: 'CONSULTING' },
    { slug: 'gn-edicao-fotos', name: 'Edição de Fotos', icon: '🖼️', archetype: 'CONSULTING' },
    { slug: 'gn-restauracao-fotos', name: 'Restauração de Fotos', icon: '📷', archetype: 'CONSULTING' },
    { slug: 'gn-autocad-3d', name: 'Autocad e Modelagem 3D', icon: '📐', archetype: 'CONSULTING' },
    { slug: 'gn-convites', name: 'Convites e Materiais Gráficos', icon: '💌', archetype: 'GENERIC' },
    { slug: 'gn-producao-grafica', name: 'Produção Gráfica', icon: '🖨️', archetype: 'GENERIC' },
    { slug: 'gn-automacao-comercial', name: 'Automação Comercial', icon: '🛒', archetype: 'CONSULTING' },
    { slug: 'gn-corte-laser', name: 'Corte e Gravação a Laser', icon: '✂️', archetype: 'GENERIC' },
    { slug: 'gn-servicos-ti', name: 'Serviços de TI', icon: '💻', archetype: 'CONSULTING' },
    { slug: 'gn-streaming', name: 'Soluções em Streaming', icon: '📺', archetype: 'CONSULTING' },
    { slug: 'gn-audio-video', name: 'Edição de Áudio e Vídeo', icon: '🎬', archetype: 'CONSULTING' },
    { slug: 'gn-diagramador', name: 'Diagramador', icon: '📰', archetype: 'CONSULTING' },
    { slug: 'gn-panfletagem', name: 'Panfletagem', icon: '📄', archetype: 'GENERIC' },
    { slug: 'gn-materiais-promocionais', name: 'Materiais Promocionais', icon: '🎁', archetype: 'GENERIC' },
  ],
}

// ============================================================
// EXECUÇÃO
// ============================================================
async function main() {
  console.log('🌱 Seed de expansão (GetNinjas + precificação dinâmica)')

  // Upsert dos grupos
  const groupMap: Record<string, string> = {}
  for (const g of GROUPS) {
    const created = await prisma.serviceGroup.upsert({
      where: { slug: g.slug },
      update: { name: g.name, icon: g.icon, order: g.order },
      create: { slug: g.slug, name: g.name, icon: g.icon, order: g.order, is_active: true },
    })
    groupMap[g.slug] = created.id
  }
  console.log(`   ✓ ${GROUPS.length} grupos`)

  let totalCats = 0
  let totalFields = 0

  for (const [groupSlug, cats] of Object.entries(CATEGORIES)) {
    const groupId = groupMap[groupSlug]
    if (!groupId) continue

    for (let i = 0; i < cats.length; i++) {
      const c = cats[i]
      const archetype: Archetype = ARCHETYPES[c.archetype]
      const pricingFormula = c.pricing_formula ?? archetype.pricing_formula
      const pricingUnit = c.pricing_unit ?? archetype.pricing_unit

      // Calcular base_price_min/max plausível a partir da fórmula se não vier explícito
      const baseMin = c.base_price_min ?? guessBaseMin(pricingFormula)
      const baseMax = c.base_price_max ?? guessBaseMax(pricingFormula)

      const cat = await prisma.category.upsert({
        where: { slug: c.slug },
        update: {
          name: c.name, icon: c.icon, group_id: groupId, order: i,
          archetype: archetype.name,
          pricing_formula: pricingFormula,
          pricing_unit: pricingUnit,
          base_price_min: baseMin,
          base_price_max: baseMax,
        },
        create: {
          slug: c.slug, name: c.name, icon: c.icon, group_id: groupId,
          order: i, requires_photos: true,
          archetype: archetype.name,
          pricing_formula: pricingFormula,
          pricing_unit: pricingUnit,
          base_price_min: baseMin,
          base_price_max: baseMax,
        },
      })
      totalCats++

      // Replicar campos do arquétipo (apenas se ainda não houver nenhum field)
      const existing = await prisma.questionnaireField.count({ where: { category_id: cat.id } })
      if (existing === 0) {
        for (let fi = 0; fi < archetype.fields.length; fi++) {
          const f = archetype.fields[fi]
          await prisma.questionnaireField.create({
            data: {
              category_id: cat.id,
              question: f.question,
              field_type: f.field_type as FieldType,
              options: f.options as any,
              placeholder: f.placeholder,
              is_required: f.is_required ?? true,
              order: fi,
              affects_price: f.affects_price ?? false,
              key: f.key,
              pricing_effect: f.pricing_effect ?? null,
              help_text: f.help_text,
            },
          })
          totalFields++
        }
      }
    }
    console.log(`   ✓ ${groupSlug}: ${cats.length} categorias`)
  }

  console.log(`✅ Total: ${totalCats} categorias, ${totalFields} novos campos`)
}

function guessBaseMin(f: any): number {
  if (!f) return 80
  if (typeof f.min === 'number') return f.min
  if (typeof f.min_charge === 'number') return f.min_charge
  if (typeof f.base_rate_min === 'number') return f.base_rate_min * 4
  if (Array.isArray(f.tiers)) {
    return Math.min(...f.tiers.map((t: any) => t.min ?? t.base_rate_min ?? 80))
  }
  return 80
}

function guessBaseMax(f: any): number {
  if (!f) return 400
  if (typeof f.max === 'number') return f.max
  if (typeof f.base_rate_max === 'number') return f.base_rate_max * 20
  if (Array.isArray(f.tiers)) {
    return Math.max(...f.tiers.map((t: any) => t.max ?? t.base_rate_max ?? 400))
  }
  return 400
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
