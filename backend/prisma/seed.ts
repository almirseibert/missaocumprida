import { PrismaClient, FieldType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // ============================================================
  // GRUPOS DE SERVIÇO
  // ============================================================
  const groups = await Promise.all([
    prisma.serviceGroup.upsert({
      where: { slug: 'para-sua-casa' },
      update: {},
      create: { name: 'Para Sua Casa', slug: 'para-sua-casa', icon: '🏠', order: 1 },
    }),
    prisma.serviceGroup.upsert({
      where: { slug: 'para-seu-carro' },
      update: {},
      create: { name: 'Para Seu Carro', slug: 'para-seu-carro', icon: '🚗', order: 2 },
    }),
    prisma.serviceGroup.upsert({
      where: { slug: 'beleza-estetica' },
      update: {},
      create: { name: 'Beleza e Estética', slug: 'beleza-estetica', icon: '💇', order: 3 },
    }),
    prisma.serviceGroup.upsert({
      where: { slug: 'para-seu-pet' },
      update: {},
      create: { name: 'Para Seu Pet', slug: 'para-seu-pet', icon: '🐾', order: 4 },
    }),
    prisma.serviceGroup.upsert({
      where: { slug: 'tech-digital' },
      update: {},
      create: { name: 'Tech e Digital', slug: 'tech-digital', icon: '💻', order: 5 },
    }),
    prisma.serviceGroup.upsert({
      where: { slug: 'entregas-logistica' },
      update: {},
      create: { name: 'Entregas e Logística', slug: 'entregas-logistica', icon: '📦', order: 6 },
    }),
    prisma.serviceGroup.upsert({
      where: { slug: 'eventos-festas' },
      update: {},
      create: { name: 'Eventos e Festas', slug: 'eventos-festas', icon: '🎉', order: 7 },
    }),
    prisma.serviceGroup.upsert({
      where: { slug: 'educacao-aulas' },
      update: {},
      create: { name: 'Educação e Aulas', slug: 'educacao-aulas', icon: '📚', order: 8 },
    }),
    prisma.serviceGroup.upsert({
      where: { slug: 'fitness-bem-estar' },
      update: {},
      create: { name: 'Fitness e Bem-Estar', slug: 'fitness-bem-estar', icon: '🏋️', order: 9 },
    }),
    prisma.serviceGroup.upsert({
      where: { slug: 'saude-em-casa' },
      update: {},
      create: { name: 'Saúde em Casa', slug: 'saude-em-casa', icon: '🏥', order: 10 },
    }),
    prisma.serviceGroup.upsert({
      where: { slug: 'freelancers-digitais' },
      update: {},
      create: { name: 'Freelancers Digitais', slug: 'freelancers-digitais', icon: '🖥️', order: 11 },
    }),
    prisma.serviceGroup.upsert({
      where: { slug: 'servicos-gerais' },
      update: {},
      create: { name: 'Serviços Gerais', slug: 'servicos-gerais', icon: '🔨', order: 12 },
    }),
  ])

  const [casa, carro, beleza, pet, tech, entregas, eventos, educacao, fitness, saude, digital, gerais] = groups
  console.log('✅ Grupos criados')

  // ============================================================
  // CATEGORIAS + QUESTIONÁRIOS
  // ============================================================

  // ---------- PARA SUA CASA ----------

  const cortarGrama = await upsertCategory({
    group_id: casa.id,
    name: 'Cortar Grama',
    slug: 'cortar-grama',
    icon: '🌿',
    description: 'Corte e manutenção de grama e jardim',
    base_price_min: 80,
    base_price_max: 300,
    estimated_hours: 2,
  })
  await createQuestionnaire(cortarGrama.id, [
    { question: 'Qual o tamanho aproximado do terreno?', field_type: 'SELECT', options: ['Pequeno (até 50m²)', 'Médio (50-200m²)', 'Grande (200-500m²)', 'Muito grande (acima de 500m²)'], affects_price: true, price_modifier: { 'Pequeno (até 50m²)': 1, 'Médio (50-200m²)': 1.8, 'Grande (200-500m²)': 3, 'Muito grande (acima de 500m²)': 5 }, is_required: true },
    { question: 'Qual o tipo de grama?', field_type: 'SELECT', options: ['São Carlos', 'Bermuda', 'Batatais', 'Esmeralda', 'Não sei'], affects_price: false, is_required: false },
    { question: 'Com que frequência deseja o serviço?', field_type: 'RADIO', options: ['Apenas uma vez', 'Semanal', 'Quinzenal', 'Mensal'], affects_price: true, price_modifier: { 'Apenas uma vez': 1, 'Semanal': 0.8, 'Quinzenal': 0.85, 'Mensal': 0.9 }, is_required: true },
    { question: 'Há obstáculos no terreno?', field_type: 'SELECT', options: ['Nenhum', 'Árvores e arbustos', 'Pedras e canteiros', 'Muitos obstáculos'], affects_price: true, price_modifier: { 'Nenhum': 1, 'Árvores e arbustos': 1.2, 'Pedras e canteiros': 1.3, 'Muitos obstáculos': 1.5 }, is_required: true },
    { question: 'Precisa recolher e descartar o material cortado?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
    { question: 'Foto do terreno', field_type: 'PHOTO', is_required: true, help_text: 'Envie uma foto atual do terreno para melhor avaliação' },
  ])

  const instalarAr = await upsertCategory({
    group_id: casa.id,
    name: 'Instalar Ar Condicionado',
    slug: 'instalar-ar-condicionado',
    icon: '❄️',
    description: 'Instalação e manutenção de ar condicionado',
    base_price_min: 150,
    base_price_max: 600,
    estimated_hours: 3,
  })
  await createQuestionnaire(instalarAr.id, [
    { question: 'Tipo de serviço?', field_type: 'RADIO', options: ['Nova instalação', 'Substituição de aparelho', 'Manutenção/limpeza', 'Recarga de gás'], affects_price: true, price_modifier: { 'Nova instalação': 1.5, 'Substituição de aparelho': 1.2, 'Manutenção/limpeza': 0.6, 'Recarga de gás': 0.7 }, is_required: true },
    { question: 'Quantos BTUs tem o aparelho?', field_type: 'SELECT', options: ['9.000 BTUs', '12.000 BTUs', '18.000 BTUs', '24.000 BTUs', 'Acima de 24.000 BTUs', 'Não sei'], affects_price: true, price_modifier: { '9.000 BTUs': 1, '12.000 BTUs': 1.1, '18.000 BTUs': 1.2, '24.000 BTUs': 1.3, 'Acima de 24.000 BTUs': 1.5, 'Não sei': 1 }, is_required: true },
    { question: 'O aparelho já está comprado?', field_type: 'BOOLEAN', is_required: true, help_text: 'Se não, o profissional pode ajudar com o orçamento' },
    { question: 'Em qual andar será instalado?', field_type: 'SELECT', options: ['Térreo', '1º andar', '2º andar', '3º andar ou acima'], affects_price: true, price_modifier: { 'Térreo': 1, '1º andar': 1.1, '2º andar': 1.2, '3º andar ou acima': 1.4 }, is_required: true },
    { question: 'Já existe furo/canaleta na parede?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.3 }, is_required: true },
    { question: 'Foto do local de instalação', field_type: 'PHOTO', is_required: true },
    { question: 'Foto do aparelho (se já tiver)', field_type: 'PHOTO', is_required: false },
  ])

  const eletricista = await upsertCategory({
    group_id: casa.id,
    name: 'Eletricista',
    slug: 'eletricista',
    icon: '⚡',
    description: 'Serviços elétricos residenciais e comerciais',
    base_price_min: 100,
    base_price_max: 800,
    estimated_hours: 2,
  })
  await createQuestionnaire(eletricista.id, [
    { question: 'Qual o serviço elétrico necessário?', field_type: 'SELECT', options: ['Instalação de tomadas/interruptores', 'Troca de disjuntores', 'Instalação de iluminação', 'Instalação de ventilador de teto', 'Revisão elétrica geral', 'Instalação de chuveiro elétrico', 'Instalação de portão elétrico', 'Curto-circuito/emergência', 'Outro'], affects_price: true, price_modifier: { 'Instalação de tomadas/interruptores': 1, 'Troca de disjuntores': 1.2, 'Instalação de iluminação': 1.1, 'Revisão elétrica geral': 2, 'Curto-circuito/emergência': 1.8 }, is_required: true },
    { question: 'É residencial ou comercial?', field_type: 'RADIO', options: ['Residencial', 'Comercial', 'Industrial'], affects_price: true, price_modifier: { 'Residencial': 1, 'Comercial': 1.3, 'Industrial': 1.8 }, is_required: true },
    { question: 'Quantos pontos/locais serão atendidos?', field_type: 'SELECT', options: ['1 ponto', '2-3 pontos', '4-6 pontos', 'Mais de 6 pontos'], affects_price: true, price_modifier: { '1 ponto': 1, '2-3 pontos': 1.8, '4-6 pontos': 3, 'Mais de 6 pontos': 5 }, is_required: true },
    { question: 'Descreva o problema ou serviço com detalhes', field_type: 'TEXTAREA', is_required: true },
    { question: 'Foto do local/problema elétrico', field_type: 'PHOTO', is_required: true },
  ])

  const encanador = await upsertCategory({
    group_id: casa.id,
    name: 'Encanador / Hidráulica',
    slug: 'encanador',
    icon: '🔧',
    description: 'Serviços hidráulicos e encanamento',
    base_price_min: 100,
    base_price_max: 600,
    estimated_hours: 2,
  })
  await createQuestionnaire(encanador.id, [
    { question: 'Qual o serviço hidráulico?', field_type: 'SELECT', options: ['Trocar torneira', 'Instalar chuveiro', 'Desentupir vaso/pia/ralo', 'Consertar vazamento', 'Instalar caixa d\'água', 'Instalar filtro de água', 'Revisão geral', 'Outro'], affects_price: true, price_modifier: { 'Trocar torneira': 0.8, 'Instalar chuveiro': 1, 'Desentupir vaso/pia/ralo': 0.9, 'Consertar vazamento': 1.2, 'Instalar caixa d\'água': 2 }, is_required: true },
    { question: 'O vazamento/problema é urgente?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.5, 'false': 1 }, is_required: true },
    { question: 'A peça/material já está comprado?', field_type: 'BOOLEAN', is_required: true },
    { question: 'Foto do local/problema', field_type: 'PHOTO', is_required: true },
  ])

  const pintura = await upsertCategory({
    group_id: casa.id,
    name: 'Pintura',
    slug: 'pintura',
    icon: '🎨',
    description: 'Pintura interna e externa de imóveis',
    base_price_min: 200,
    base_price_max: 3000,
    estimated_hours: 8,
  })
  await createQuestionnaire(pintura.id, [
    { question: 'O que será pintado?', field_type: 'SELECT', options: ['Parede interna', 'Parede externa/fachada', 'Teto', 'Grade/ferro', 'Madeira', 'Piso'], affects_price: true, price_modifier: { 'Parede interna': 1, 'Parede externa/fachada': 1.4, 'Teto': 1.3, 'Grade/ferro': 1.5 }, is_required: true },
    { question: 'Quantos m² aproximadamente?', field_type: 'SELECT', options: ['Até 20m²', '20-50m²', '50-100m²', '100-200m²', 'Acima de 200m²'], affects_price: true, price_modifier: { 'Até 20m²': 1, '20-50m²': 2, '50-100m²': 3.5, '100-200m²': 6, 'Acima de 200m²': 10 }, is_required: true },
    { question: 'Quantas demãos?', field_type: 'RADIO', options: ['1 demão', '2 demãos', '3 demãos ou mais', 'Não sei'], affects_price: true, price_modifier: { '1 demão': 0.7, '2 demãos': 1, '3 demãos ou mais': 1.3 }, is_required: true },
    { question: 'A tinta já está comprada?', field_type: 'BOOLEAN', is_required: true },
    { question: 'Foto do local a ser pintado', field_type: 'PHOTO', is_required: true },
  ])

  const limpezaResidencial = await upsertCategory({
    group_id: casa.id,
    name: 'Limpeza Residencial',
    slug: 'limpeza-residencial',
    icon: '🧹',
    description: 'Limpeza geral de casas e apartamentos',
    base_price_min: 100,
    base_price_max: 500,
    estimated_hours: 4,
  })
  await createQuestionnaire(limpezaResidencial.id, [
    { question: 'Tipo de limpeza?', field_type: 'RADIO', options: ['Limpeza geral', 'Limpeza pesada', 'Limpeza pós-obra', 'Limpeza de mudança'], affects_price: true, price_modifier: { 'Limpeza geral': 1, 'Limpeza pesada': 1.5, 'Limpeza pós-obra': 2, 'Limpeza de mudança': 1.8 }, is_required: true },
    { question: 'Tamanho do imóvel?', field_type: 'SELECT', options: ['Kitnet/Studio', '1 dormitório', '2 dormitórios', '3 dormitórios', '4+ dormitórios', 'Casa grande'], affects_price: true, price_modifier: { 'Kitnet/Studio': 0.7, '1 dormitório': 1, '2 dormitórios': 1.4, '3 dormitórios': 1.8, '4+ dormitórios': 2.5, 'Casa grande': 3 }, is_required: true },
    { question: 'Inclui limpeza de banheiros?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.1, 'false': 1 }, is_required: true },
    { question: 'Inclui limpeza de janelas?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.15, 'false': 1 }, is_required: true },
    { question: 'O produto de limpeza será fornecido pelo profissional?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.1, 'false': 1 }, is_required: true },
  ])

  const limpezaPiscina = await upsertCategory({
    group_id: casa.id,
    name: 'Limpeza de Piscina',
    slug: 'limpeza-piscina',
    icon: '🏊',
    description: 'Limpeza, manutenção e tratamento de piscinas',
    base_price_min: 150,
    base_price_max: 500,
    estimated_hours: 2,
  })
  await createQuestionnaire(limpezaPiscina.id, [
    { question: 'Qual o volume da piscina?', field_type: 'SELECT', options: ['Pequena (até 20.000L)', 'Média (20.000-50.000L)', 'Grande (acima de 50.000L)', 'Não sei'], affects_price: true, price_modifier: { 'Pequena (até 20.000L)': 1, 'Média (20.000-50.000L)': 1.5, 'Grande (acima de 50.000L)': 2, 'Não sei': 1.2 }, is_required: true },
    { question: 'Tipo de piscina?', field_type: 'RADIO', options: ['Alvenaria', 'Fibra', 'Vinil', 'Plástico/Portatil'], affects_price: false, is_required: true },
    { question: 'Como está a água atualmente?', field_type: 'RADIO', options: ['Limpa e cristalina', 'Levemente turva', 'Turva (verde/amarela)', 'Muito suja (verde escuro)'], affects_price: true, price_modifier: { 'Limpa e cristalina': 0.8, 'Levemente turva': 1, 'Turva (verde/amarela)': 1.4, 'Muito suja (verde escuro)': 2 }, is_required: true },
    { question: 'O equipamento de filtragem está funcionando?', field_type: 'BOOLEAN', is_required: true },
    { question: 'Precisa de tratamento químico?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.3, 'false': 1 }, is_required: true },
    { question: 'Foto atual da piscina', field_type: 'PHOTO', is_required: true },
  ])

  const organizarGaragem = await upsertCategory({
    group_id: casa.id,
    name: 'Organizar Garagem / Espaços',
    slug: 'organizar-garagem',
    icon: '📦',
    description: 'Organização de garagens, armários e espaços',
    base_price_min: 100,
    base_price_max: 400,
    estimated_hours: 3,
  })
  await createQuestionnaire(organizarGaragem.id, [
    { question: 'O que será organizado?', field_type: 'SELECT', options: ['Garagem', 'Armário/guarda-roupa', 'Despensa/cozinha', 'Escritório', 'Quarto/sala', 'Galpão'], affects_price: true, price_modifier: { 'Garagem': 1, 'Armário/guarda-roupa': 0.8, 'Despensa/cozinha': 0.7, 'Escritório': 0.8, 'Galpão': 2 }, is_required: true },
    { question: 'Qual o nível de desorganização?', field_type: 'RADIO', options: ['Leve (poucas coisas)', 'Moderado', 'Muito desorganizado', 'Caótico (precisa de muito trabalho)'], affects_price: true, price_modifier: { 'Leve (poucas coisas)': 0.7, 'Moderado': 1, 'Muito desorganizado': 1.5, 'Caótico (precisa de muito trabalho)': 2 }, is_required: true },
    { question: 'Precisa descartar itens? (levar para doação/descarte)', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.3, 'false': 1 }, is_required: true },
    { question: 'Foto atual do espaço', field_type: 'PHOTO', is_required: true },
  ])

  const limpezaTelhado = await upsertCategory({
    group_id: casa.id,
    name: 'Limpeza de Telhado',
    slug: 'limpeza-telhado',
    icon: '🏗️',
    description: 'Limpeza e impermeabilização de telhados',
    base_price_min: 200,
    base_price_max: 1000,
    estimated_hours: 4,
  })
  await createQuestionnaire(limpezaTelhado.id, [
    { question: 'Tipo de serviço no telhado?', field_type: 'SELECT', options: ['Limpeza de telhas', 'Desobstrução de calhas', 'Impermeabilização', 'Troca de telhas quebradas', 'Revisão completa'], affects_price: true, price_modifier: { 'Limpeza de telhas': 1, 'Desobstrução de calhas': 0.8, 'Impermeabilização': 1.8, 'Troca de telhas quebradas': 1.5, 'Revisão completa': 2 }, is_required: true },
    { question: 'Área aproximada do telhado?', field_type: 'SELECT', options: ['Até 50m²', '50-100m²', '100-200m²', 'Acima de 200m²'], affects_price: true, price_modifier: { 'Até 50m²': 1, '50-100m²': 1.6, '100-200m²': 2.5, 'Acima de 200m²': 4 }, is_required: true },
    { question: 'Tipo de telhado?', field_type: 'SELECT', options: ['Telha cerâmica', 'Telha de concreto', 'Telha metálica', 'Laje impermeabilizada', 'Fibrocimento'], affects_price: false, is_required: true },
    { question: 'Foto do telhado', field_type: 'PHOTO', is_required: true },
  ])

  const dedetizacao = await upsertCategory({
    group_id: casa.id,
    name: 'Dedetização / Controle de Pragas',
    slug: 'dedetizacao',
    icon: '🐛',
    description: 'Eliminação de pragas e insetos',
    base_price_min: 150,
    base_price_max: 600,
    estimated_hours: 2,
  })
  await createQuestionnaire(dedetizacao.id, [
    { question: 'Qual praga/inseto?', field_type: 'SELECT', options: ['Baratas', 'Formigas', 'Cupins', 'Ratos/camundongos', 'Escorpiões', 'Mosquitos/dengue', 'Abelhas/vespas', 'Pombos', 'Múltiplas pragas'], affects_price: true, price_modifier: { 'Cupins': 1.8, 'Ratos/camundongos': 1.5, 'Pombos': 1.6, 'Múltiplas pragas': 2 }, is_required: true },
    { question: 'Tipo de imóvel?', field_type: 'RADIO', options: ['Casa', 'Apartamento', 'Comércio', 'Galpão/Armazém'], affects_price: true, price_modifier: { 'Casa': 1, 'Apartamento': 0.8, 'Comércio': 1.3, 'Galpão/Armazém': 2 }, is_required: true },
    { question: 'Área total em m²?', field_type: 'SELECT', options: ['Até 60m²', '60-120m²', '120-250m²', 'Acima de 250m²'], affects_price: true, price_modifier: { 'Até 60m²': 1, '60-120m²': 1.4, '120-250m²': 2, 'Acima de 250m²': 3 }, is_required: true },
    { question: 'Foto do local com a praga (se possível)', field_type: 'PHOTO', is_required: false },
  ])

  const marcenaria = await upsertCategory({
    group_id: casa.id,
    name: 'Marcenaria / Montagem de Móveis',
    slug: 'marcenaria',
    icon: '🪵',
    description: 'Móveis sob medida, consertos e montagem',
    base_price_min: 80,
    base_price_max: 500,
    estimated_hours: 3,
  })
  await createQuestionnaire(marcenaria.id, [
    { question: 'Tipo de serviço?', field_type: 'SELECT', options: ['Montagem de móvel comprado', 'Conserto de móvel', 'Móvel sob medida', 'Instalação de prateleiras', 'Instalação de guarda-roupa'], affects_price: true, price_modifier: { 'Montagem de móvel comprado': 1, 'Conserto de móvel': 0.8, 'Móvel sob medida': 3, 'Instalação de prateleiras': 0.7, 'Instalação de guarda-roupa': 1.5 }, is_required: true },
    { question: 'Quantas peças/móveis?', field_type: 'SELECT', options: ['1 peça', '2-3 peças', '4-6 peças', 'Mais de 6 peças'], affects_price: true, price_modifier: { '1 peça': 1, '2-3 peças': 2.2, '4-6 peças': 4, 'Mais de 6 peças': 6 }, is_required: true },
    { question: 'Foto do móvel / do local', field_type: 'PHOTO', is_required: true },
  ])

  console.log('✅ Categorias "Para Sua Casa" criadas')

  // ---------- PARA SEU CARRO ----------

  const lavagemCarro = await upsertCategory({
    group_id: carro.id,
    name: 'Lavagem de Carro',
    slug: 'lavagem-carro',
    icon: '🚿',
    description: 'Lavagem simples, completa e detalhamento',
    base_price_min: 50,
    base_price_max: 300,
    estimated_hours: 1,
  })
  await createQuestionnaire(lavagemCarro.id, [
    { question: 'Tipo de lavagem?', field_type: 'RADIO', options: ['Simples (externa)', 'Completa (externa + interna)', 'Detalhamento completo', 'Higienização interna'], affects_price: true, price_modifier: { 'Simples (externa)': 0.5, 'Completa (externa + interna)': 1, 'Detalhamento completo': 2.5, 'Higienização interna': 1.8 }, is_required: true },
    { question: 'Porte do veículo?', field_type: 'SELECT', options: ['Moto', 'Carro pequeno (Uno, HB20)', 'Carro médio (Corolla, Cruze)', 'SUV/Caminhonete', 'Van/Sprinter', 'Caminhão'], affects_price: true, price_modifier: { 'Moto': 0.5, 'Carro pequeno (Uno, HB20)': 1, 'Carro médio (Corolla, Cruze)': 1.2, 'SUV/Caminhonete': 1.5, 'Van/Sprinter': 2, 'Caminhão': 3 }, is_required: true },
    { question: 'O profissional vai até você?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
    { question: 'Foto do veículo', field_type: 'PHOTO', is_required: false },
  ])

  const mecanicaLeve = await upsertCategory({
    group_id: carro.id,
    name: 'Mecânica Leve',
    slug: 'mecanica-leve',
    icon: '🔩',
    description: 'Troca de óleo, pneus, baterias e serviços simples',
    base_price_min: 80,
    base_price_max: 400,
    estimated_hours: 1,
  })
  await createQuestionnaire(mecanicaLeve.id, [
    { question: 'Qual serviço?', field_type: 'SELECT', options: ['Troca de óleo', 'Troca de pneu', 'Troca de bateria', 'Alinhamento e balanceamento', 'Revisão de freios', 'Troca de filtros', 'Diagnóstico computadorizado'], affects_price: true, price_modifier: { 'Troca de óleo': 1, 'Diagnóstico computadorizado': 1.3, 'Revisão de freios': 1.5 }, is_required: true },
    { question: 'O profissional vai até você?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.3, 'false': 1 }, is_required: true },
    { question: 'O produto/peça já está comprado?', field_type: 'BOOLEAN', is_required: true },
    { question: 'Modelo e ano do veículo', field_type: 'TEXT', is_required: true, placeholder: 'Ex: Honda Civic 2020' },
  ])

  const funilariaPintura = await upsertCategory({
    group_id: carro.id,
    name: 'Funilaria e Pintura Automotiva',
    slug: 'funilaria-pintura',
    icon: '🔧',
    description: 'Amassados, riscos e pintura de carros',
    base_price_min: 150,
    base_price_max: 2000,
    estimated_hours: 4,
  })
  await createQuestionnaire(funilariaPintura.id, [
    { question: 'Tipo de dano?', field_type: 'SELECT', options: ['Arranhão superficial', 'Risco profundo na tinta', 'Amassado pequeno (sem quebrar)', 'Amassado com peça quebrada', 'Pintura completa de peça', 'Polimento e lustração'], affects_price: true, price_modifier: { 'Arranhão superficial': 0.4, 'Risco profundo na tinta': 0.7, 'Amassado pequeno (sem quebrar)': 1, 'Amassado com peça quebrada': 2, 'Pintura completa de peça': 1.8, 'Polimento e lustração': 0.6 }, is_required: true },
    { question: 'Quantas peças/painéis afetados?', field_type: 'SELECT', options: ['1 peça', '2-3 peças', '4-6 peças', 'Carro inteiro'], affects_price: true, price_modifier: { '1 peça': 1, '2-3 peças': 2.5, '4-6 peças': 4, 'Carro inteiro': 8 }, is_required: true },
    { question: 'Porte do veículo?', field_type: 'SELECT', options: ['Moto', 'Carro pequeno', 'Carro médio', 'SUV/Caminhonete', 'Van'], affects_price: true, price_modifier: { 'Moto': 0.6, 'Carro pequeno': 1, 'Carro médio': 1.2, 'SUV/Caminhonete': 1.5, 'Van': 1.8 }, is_required: true },
    { question: 'Foto do dano', field_type: 'PHOTO', is_required: true },
  ])

  const insulfilm = await upsertCategory({
    group_id: carro.id,
    name: 'Insulfilm / Película Automotiva',
    slug: 'insulfilm',
    icon: '🪟',
    description: 'Aplicação de insulfilm e películas protetoras',
    base_price_min: 150,
    base_price_max: 600,
    estimated_hours: 3,
  })
  await createQuestionnaire(insulfilm.id, [
    { question: 'Tipo de película?', field_type: 'SELECT', options: ['Insulfilm padrão (privacidade)', 'Película fumê (decorativa)', 'Película nano cerâmica (rejeição de calor)', 'Película de segurança', 'Película de proteção de pintura (PPF)'], affects_price: true, price_modifier: { 'Insulfilm padrão (privacidade)': 1, 'Película fumê (decorativa)': 0.9, 'Película nano cerâmica (rejeição de calor)': 2, 'Película de segurança': 1.5, 'Película de proteção de pintura (PPF)': 3 }, is_required: true },
    { question: 'Quais vidros serão cobertos?', field_type: 'SELECT', options: ['Somente traseiros (laterais + traseiro)', 'Todos os vidros', 'Apenas para-brisa', 'Vidros laterais traseiros + traseiro + para-brisa'], affects_price: true, price_modifier: { 'Somente traseiros (laterais + traseiro)': 1, 'Todos os vidros': 1.5, 'Apenas para-brisa': 0.6, 'Vidros laterais traseiros + traseiro + para-brisa': 1.8 }, is_required: true },
    { question: 'Porte do veículo?', field_type: 'SELECT', options: ['Carro pequeno', 'Carro médio', 'SUV/Caminhonete', 'Van/Minivan'], affects_price: true, price_modifier: { 'Carro pequeno': 1, 'Carro médio': 1.1, 'SUV/Caminhonete': 1.3, 'Van/Minivan': 1.6 }, is_required: true },
    { question: 'O veículo já tem película antiga para remover?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
  ])

  const somAutomotivo = await upsertCategory({
    group_id: carro.id,
    name: 'Som e Acessórios Automotivos',
    slug: 'som-automotivo',
    icon: '🔊',
    description: 'Instalação de som, central multimídia e acessórios',
    base_price_min: 80,
    base_price_max: 500,
    estimated_hours: 2,
  })
  await createQuestionnaire(somAutomotivo.id, [
    { question: 'Tipo de serviço?', field_type: 'SELECT', options: ['Instalação de rádio/central multimídia', 'Instalação de alto-falantes', 'Instalação de subwoofer', 'Instalação de câmera de ré', 'Instalação de sensor de estacionamento', 'Instalação de rastreador/alarme', 'Sistema completo'], affects_price: true, price_modifier: { 'Instalação de rádio/central multimídia': 1, 'Instalação de subwoofer': 1.3, 'Sistema completo': 3 }, is_required: true },
    { question: 'O equipamento já está comprado?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.4 }, is_required: true },
    { question: 'Modelo e ano do veículo', field_type: 'TEXT', is_required: true, placeholder: 'Ex: Volkswagen Gol 2018' },
  ])

  const chaveiroAutomotivo = await upsertCategory({
    group_id: carro.id,
    name: 'Chaveiro Automotivo',
    slug: 'chaveiro-automotivo',
    icon: '🔑',
    description: 'Cópia de chaves, abertura e codificação de transponder',
    base_price_min: 80,
    base_price_max: 600,
    estimated_hours: 1,
  })
  await createQuestionnaire(chaveiroAutomotivo.id, [
    { question: 'Tipo de serviço?', field_type: 'RADIO', options: ['Cópia de chave simples', 'Chave com transponder/chip', 'Abrir carro trancado (chave dentro)', 'Programar controle remoto', 'Ignição com defeito'], affects_price: true, price_modifier: { 'Cópia de chave simples': 0.5, 'Chave com transponder/chip': 2, 'Abrir carro trancado (chave dentro)': 1, 'Programar controle remoto': 1.5, 'Ignição com defeito': 2 }, is_required: true },
    { question: 'É urgente? (atendimento imediato)', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.4, 'false': 1 }, is_required: true },
    { question: 'Marca e modelo do veículo', field_type: 'TEXT', is_required: true, placeholder: 'Ex: Fiat Uno 2015' },
  ])

  const reboque = await upsertCategory({
    group_id: carro.id,
    name: 'Reboque / Guincho',
    slug: 'reboque-guincho',
    icon: '🚛',
    description: 'Reboque de veículos em pane, acidente ou estacionamento',
    base_price_min: 100,
    base_price_max: 800,
    estimated_hours: 1,
  })
  await createQuestionnaire(reboque.id, [
    { question: 'Motivo do reboque?', field_type: 'RADIO', options: ['Pane mecânica', 'Pane elétrica', 'Acidente/batida', 'Carro atolado', 'Pneu furado sem estepe', 'Outro'], affects_price: false, is_required: true },
    { question: 'Porte do veículo?', field_type: 'SELECT', options: ['Moto', 'Carro', 'SUV/Caminhonete', 'Van/Kombi', 'Caminhão pequeno'], affects_price: true, price_modifier: { 'Moto': 0.6, 'Carro': 1, 'SUV/Caminhonete': 1.3, 'Van/Kombi': 1.5, 'Caminhão pequeno': 2 }, is_required: true },
    { question: 'Distância do reboque (origem → destino)?', field_type: 'SELECT', options: ['Até 10km', '10-30km', '30-60km', 'Acima de 60km'], affects_price: true, price_modifier: { 'Até 10km': 1, '10-30km': 1.5, '30-60km': 2.5, 'Acima de 60km': 4 }, is_required: true },
    { question: 'Localização atual do veículo (descreva)', field_type: 'TEXTAREA', is_required: true, placeholder: 'Ex: Rua das Flores, próximo ao número 200, bairro Centro' },
  ])

  console.log('✅ Categorias "Para Seu Carro" criadas')

  // ---------- PARA VOCÊ ----------

  const corteCabelo = await upsertCategory({
    group_id: beleza.id,
    name: 'Corte de Cabelo',
    slug: 'corte-cabelo',
    icon: '✂️',
    description: 'Cortes masculinos, femininos e infantis em domicílio',
    base_price_min: 40,
    base_price_max: 200,
    estimated_hours: 1,
  })
  await createQuestionnaire(corteCabelo.id, [
    { question: 'Para quem é o corte?', field_type: 'RADIO', options: ['Masculino adulto', 'Feminino adulto', 'Infantil (menino)', 'Infantil (menina)'], affects_price: true, price_modifier: { 'Masculino adulto': 1, 'Feminino adulto': 1.5, 'Infantil (menino)': 0.8, 'Infantil (menina)': 1 }, is_required: true },
    { question: 'Tipo de corte?', field_type: 'SELECT', options: ['Degradê/Fade', 'Social', 'Na tesoura (comprimento)', 'Navalhado', 'Franja', 'Corte + barba'], affects_price: true, price_modifier: { 'Corte + barba': 1.4, 'Degradê/Fade': 1.1 }, is_required: true },
    { question: 'Inclui lavagem e escova?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.3, 'false': 1 }, is_required: true },
    { question: 'O profissional vai até você?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
    { question: 'Foto de referência do corte desejado', field_type: 'PHOTO', is_required: false, help_text: 'Opcional — envie para o profissional saber exatamente o que você quer' },
  ])

  const manicurePedicure = await upsertCategory({
    group_id: beleza.id,
    name: 'Manicure e Pedicure',
    slug: 'manicure-pedicure',
    icon: '💅',
    description: 'Manicure, pedicure, esmaltação e nail art',
    base_price_min: 40,
    base_price_max: 150,
    estimated_hours: 1,
  })
  await createQuestionnaire(manicurePedicure.id, [
    { question: 'Qual serviço?', field_type: 'SELECT', options: ['Manicure simples', 'Pedicure simples', 'Manicure + Pedicure', 'Esmaltação em gel', 'Unhas de gel/acrílico', 'Nail art', 'Remoção de gel/acrílico'], affects_price: true, price_modifier: { 'Manicure simples': 1, 'Pedicure simples': 1, 'Manicure + Pedicure': 1.8, 'Esmaltação em gel': 1.5, 'Unhas de gel/acrílico': 2.5, 'Nail art': 2 }, is_required: true },
    { question: 'O profissional vai até você?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
    { question: 'Referência de design/cor (opcional)', field_type: 'PHOTO', is_required: false },
  ])

  const maquiagem = await upsertCategory({
    group_id: beleza.id,
    name: 'Maquiagem',
    slug: 'maquiagem',
    icon: '💄',
    description: 'Maquiagem social, artística e para noivas',
    base_price_min: 80,
    base_price_max: 500,
    estimated_hours: 1,
  })
  await createQuestionnaire(maquiagem.id, [
    { question: 'Tipo de maquiagem?', field_type: 'RADIO', options: ['Social (dia a dia)', 'Festa/evento', 'Noiva', 'Artística/fantasy', 'Teens (adolescente)', 'Maquiagem para fotos/ensaio'], affects_price: true, price_modifier: { 'Social (dia a dia)': 0.8, 'Festa/evento': 1, 'Noiva': 2, 'Artística/fantasy': 1.5, 'Maquiagem para fotos/ensaio': 1.3 }, is_required: true },
    { question: 'Inclui penteado?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.5, 'false': 1 }, is_required: true },
    { question: 'Para quantas pessoas?', field_type: 'SELECT', options: ['1 pessoa', '2-3 pessoas', '4-6 pessoas', 'Mais de 6 pessoas'], affects_price: true, price_modifier: { '1 pessoa': 1, '2-3 pessoas': 2.5, '4-6 pessoas': 4.5, 'Mais de 6 pessoas': 7 }, is_required: true },
    { question: 'Referência de maquiagem', field_type: 'PHOTO', is_required: false },
  ])

  const massagem = await upsertCategory({
    group_id: beleza.id,
    name: 'Massagem',
    slug: 'massagem',
    icon: '💆',
    description: 'Massagem relaxante, terapêutica e shiatsu em domicílio',
    base_price_min: 100,
    base_price_max: 300,
    estimated_hours: 1,
  })
  await createQuestionnaire(massagem.id, [
    { question: 'Tipo de massagem?', field_type: 'SELECT', options: ['Relaxante', 'Terapêutica', 'Shiatsu', 'Drenagem linfática', 'Reflexologia', 'Hot stone', 'Desportiva'], affects_price: true, price_modifier: { 'Relaxante': 1, 'Terapêutica': 1.2, 'Drenagem linfática': 1.3, 'Hot stone': 1.4 }, is_required: true },
    { question: 'Duração da sessão?', field_type: 'RADIO', options: ['30 minutos', '60 minutos', '90 minutos', '120 minutos'], affects_price: true, price_modifier: { '30 minutos': 0.6, '60 minutos': 1, '90 minutos': 1.4, '120 minutos': 1.8 }, is_required: true },
    { question: 'Tem alguma condição de saúde que o profissional deve saber?', field_type: 'TEXTAREA', is_required: false },
  ])

  const depilacao = await upsertCategory({
    group_id: beleza.id,
    name: 'Depilação',
    slug: 'depilacao',
    icon: '🪒',
    description: 'Depilação com cera, linha, laser e henna em domicílio',
    base_price_min: 40,
    base_price_max: 300,
    estimated_hours: 1,
  })
  await createQuestionnaire(depilacao.id, [
    { question: 'Região a depilar?', field_type: 'SELECT', options: ['Sobrancelha', 'Buço', 'Axilas', 'Virilha simples', 'Virilha completa (cavada)', 'Pernas (meia perna)', 'Pernas (perna inteira)', 'Braços', 'Costas/abdômen', 'Corpo inteiro'], affects_price: true, price_modifier: { 'Sobrancelha': 0.4, 'Buço': 0.3, 'Axilas': 0.5, 'Virilha simples': 0.8, 'Virilha completa (cavada)': 1.2, 'Pernas (meia perna)': 1, 'Pernas (perna inteira)': 1.5, 'Braços': 1, 'Costas/abdômen': 1.2, 'Corpo inteiro': 3 }, is_required: true },
    { question: 'Método preferido?', field_type: 'RADIO', options: ['Cera quente', 'Cera fria', 'Linha', 'Pinça', 'Creme depilatório', 'Henna (para sobrancelha)'], affects_price: true, price_modifier: { 'Cera quente': 1, 'Cera fria': 0.9, 'Linha': 0.8, 'Henna (para sobrancelha)': 1.5 }, is_required: true },
    { question: 'O profissional vai até você?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
  ])

  const coloracaoCabelo = await upsertCategory({
    group_id: beleza.id,
    name: 'Coloração e Química Capilar',
    slug: 'coloracao-cabelo',
    icon: '🎨',
    description: 'Tintura, mechas, progressiva, botox capilar e relaxamento',
    base_price_min: 80,
    base_price_max: 600,
    estimated_hours: 3,
  })
  await createQuestionnaire(coloracaoCabelo.id, [
    { question: 'Tipo de serviço?', field_type: 'SELECT', options: ['Tintura simples (raiz)', 'Tintura completa', 'Mechas/Balayage/Luzes', 'Progressiva/Escova progressiva', 'Botox capilar', 'Relaxamento', 'Descoloração', 'Tonalização'], affects_price: true, price_modifier: { 'Tintura simples (raiz)': 0.8, 'Tintura completa': 1, 'Mechas/Balayage/Luzes': 2, 'Progressiva/Escova progressiva': 2, 'Botox capilar': 1.5, 'Relaxamento': 1.8, 'Descoloração': 1.3 }, is_required: true },
    { question: 'Comprimento do cabelo?', field_type: 'RADIO', options: ['Curto (até ombro)', 'Médio (até axila)', 'Longo (até cintura)', 'Extra longo (abaixo da cintura)'], affects_price: true, price_modifier: { 'Curto (até ombro)': 0.8, 'Médio (até axila)': 1, 'Longo (até cintura)': 1.4, 'Extra longo (abaixo da cintura)': 1.8 }, is_required: true },
    { question: 'O produto/tinta já está comprado?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.3 }, is_required: true },
    { question: 'O profissional vai até você?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
    { question: 'Foto de referência do resultado desejado', field_type: 'PHOTO', is_required: false },
  ])

  const barbeiro = await upsertCategory({
    group_id: beleza.id,
    name: 'Barbeiro em Domicílio',
    slug: 'barbeiro',
    icon: '🧔',
    description: 'Corte masculino, barba e serviços de barbearia em casa',
    base_price_min: 50,
    base_price_max: 200,
    estimated_hours: 1,
  })
  await createQuestionnaire(barbeiro.id, [
    { question: 'Serviço desejado?', field_type: 'SELECT', options: ['Somente barba', 'Somente cabelo', 'Cabelo + barba', 'Bigode e acabamento', 'Sobrancelha masculina', 'Pacote completo (cabelo + barba + sobrancelha)'], affects_price: true, price_modifier: { 'Somente barba': 0.6, 'Somente cabelo': 0.8, 'Cabelo + barba': 1, 'Pacote completo (cabelo + barba + sobrancelha)': 1.4 }, is_required: true },
    { question: 'Tipo de acabamento de barba?', field_type: 'RADIO', options: ['Navalhado (pele a pele)', 'Na máquina (nível 0-3)', 'Modelada (manter formato)', 'Não se aplica'], affects_price: true, price_modifier: { 'Navalhado (pele a pele)': 1.2, 'Na máquina (nível 0-3)': 1, 'Modelada (manter formato)': 1.1, 'Não se aplica': 1 }, is_required: true },
    { question: 'Para quantas pessoas?', field_type: 'SELECT', options: ['1 pessoa', '2 pessoas', '3-4 pessoas'], affects_price: true, price_modifier: { '1 pessoa': 1, '2 pessoas': 1.8, '3-4 pessoas': 3 }, is_required: true },
    { question: 'Foto de referência (opcional)', field_type: 'PHOTO', is_required: false },
  ])

  const esteticaFacial = await upsertCategory({
    group_id: beleza.id,
    name: 'Estética Facial / Limpeza de Pele',
    slug: 'estetica-facial',
    icon: '🧖',
    description: 'Limpeza de pele, peeling, hidratação e tratamentos faciais',
    base_price_min: 80,
    base_price_max: 400,
    estimated_hours: 1,
  })
  await createQuestionnaire(esteticaFacial.id, [
    { question: 'Tipo de tratamento?', field_type: 'SELECT', options: ['Limpeza de pele profunda', 'Peeling químico', 'Hidratação facial', 'Máscara facial', 'Drenagem facial', 'Microagulhamento', 'LED terapia', 'Sobrancelha design + henna'], affects_price: true, price_modifier: { 'Limpeza de pele profunda': 1, 'Peeling químico': 1.5, 'Microagulhamento': 2, 'LED terapia': 1.3, 'Sobrancelha design + henna': 0.8 }, is_required: true },
    { question: 'Tipo de pele?', field_type: 'RADIO', options: ['Seca', 'Oleosa', 'Mista', 'Sensível', 'Não sei'], affects_price: false, is_required: true },
    { question: 'Tem acne ativa ou condição de pele?', field_type: 'BOOLEAN', is_required: true, help_text: 'Importante para o profissional escolher o protocolo correto' },
    { question: 'O profissional vai até você?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
  ])

  const micropigmentacao = await upsertCategory({
    group_id: beleza.id,
    name: 'Micropigmentação',
    slug: 'micropigmentacao',
    icon: '✍️',
    description: 'Micropigmentação de sobrancelha, lábios e couro cabeludo',
    base_price_min: 300,
    base_price_max: 1500,
    estimated_hours: 3,
  })
  await createQuestionnaire(micropigmentacao.id, [
    { question: 'Região a micropigmentar?', field_type: 'RADIO', options: ['Sobrancelha (fio a fio)', 'Sobrancelha (sombreamento)', 'Sobrancelha (mista)', 'Lábios', 'Couro cabeludo (simulação capilar)', 'Linha dos olhos'], affects_price: true, price_modifier: { 'Sobrancelha (fio a fio)': 1, 'Sobrancelha (sombreamento)': 0.9, 'Sobrancelha (mista)': 1.1, 'Lábios': 1.3, 'Couro cabeludo (simulação capilar)': 2, 'Linha dos olhos': 1.2 }, is_required: true },
    { question: 'É a primeira vez ou retoque?', field_type: 'RADIO', options: ['Primeira vez', 'Retoque (até 1 ano)', 'Retoque (mais de 1 ano)', 'Correção de outra micropig'], affects_price: true, price_modifier: { 'Primeira vez': 1, 'Retoque (até 1 ano)': 0.5, 'Retoque (mais de 1 ano)': 0.7, 'Correção de outra micropig': 1.2 }, is_required: true },
    { question: 'Foto de referência do resultado desejado', field_type: 'PHOTO', is_required: true },
  ])

  console.log('✅ Categorias "Beleza e Estética" criadas')

  // ---------- PARA SEU PET ----------

  const banhaTosa = await upsertCategory({
    group_id: pet.id,
    name: 'Banho e Tosa',
    slug: 'banho-tosa',
    icon: '🐶',
    description: 'Banho, tosa e grooming para cães e gatos',
    base_price_min: 40,
    base_price_max: 200,
    estimated_hours: 1,
  })
  await createQuestionnaire(banhaTosa.id, [
    { question: 'Tipo de animal?', field_type: 'RADIO', options: ['Cão', 'Gato', 'Outro'], affects_price: true, price_modifier: { 'Cão': 1, 'Gato': 1.3, 'Outro': 1 }, is_required: true },
    { question: 'Porte do animal?', field_type: 'SELECT', options: ['Mini (até 5kg)', 'Pequeno (5-10kg)', 'Médio (10-20kg)', 'Grande (20-40kg)', 'Gigante (acima de 40kg)'], affects_price: true, price_modifier: { 'Mini (até 5kg)': 0.7, 'Pequeno (5-10kg)': 1, 'Médio (10-20kg)': 1.4, 'Grande (20-40kg)': 1.8, 'Gigante (acima de 40kg)': 2.5 }, is_required: true },
    { question: 'Tipo de pelagem?', field_type: 'RADIO', options: ['Curta', 'Média', 'Longa', 'Encaracolada'], affects_price: true, price_modifier: { 'Curta': 1, 'Média': 1.1, 'Longa': 1.3, 'Encaracolada': 1.4 }, is_required: true },
    { question: 'Serviço desejado?', field_type: 'SELECT', options: ['Somente banho', 'Banho + tosa higiênica', 'Banho + tosa completa', 'Somente tosa'], affects_price: true, price_modifier: { 'Somente banho': 0.7, 'Banho + tosa higiênica': 1, 'Banho + tosa completa': 1.5, 'Somente tosa': 1.2 }, is_required: true },
    { question: 'O profissional vai até você?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
    { question: 'Foto do pet', field_type: 'PHOTO', is_required: false },
  ])

  const dogWalker = await upsertCategory({
    group_id: pet.id,
    name: 'Passeio com Cão (Dog Walker)',
    slug: 'dog-walker',
    icon: '🦮',
    description: 'Passeio diário ou semanal com seu cão',
    base_price_min: 30,
    base_price_max: 100,
    estimated_hours: 1,
  })
  await createQuestionnaire(dogWalker.id, [
    { question: 'Duração do passeio?', field_type: 'RADIO', options: ['30 minutos', '1 hora', '2 horas'], affects_price: true, price_modifier: { '30 minutos': 0.7, '1 hora': 1, '2 horas': 1.8 }, is_required: true },
    { question: 'Quantos cães?', field_type: 'SELECT', options: ['1 cão', '2 cães', '3+ cães'], affects_price: true, price_modifier: { '1 cão': 1, '2 cães': 1.6, '3+ cães': 2 }, is_required: true },
    { question: 'Frequência desejada?', field_type: 'RADIO', options: ['Única vez', 'Diária', '3x por semana', 'Semanal'], affects_price: true, price_modifier: { 'Única vez': 1, 'Diária': 0.75, '3x por semana': 0.8, 'Semanal': 0.85 }, is_required: true },
    { question: 'O cão é sociável com outros animais?', field_type: 'BOOLEAN', is_required: true },
  ])

  const veterinarioDomiciliar = await upsertCategory({
    group_id: pet.id,
    name: 'Veterinário Domiciliar',
    slug: 'veterinario-domiciliar',
    icon: '🩺',
    description: 'Consultas, vacinas e exames veterinários em casa',
    base_price_min: 120,
    base_price_max: 400,
    estimated_hours: 1,
  })
  await createQuestionnaire(veterinarioDomiciliar.id, [
    { question: 'Tipo de atendimento?', field_type: 'SELECT', options: ['Consulta geral', 'Vacinação', 'Vermifugação', 'Curativo/pós-cirúrgico', 'Aplicação de medicamento', 'Eutanásia humanizada', 'Exame clínico'], affects_price: true, price_modifier: { 'Consulta geral': 1, 'Vacinação': 0.8, 'Eutanásia humanizada': 1.5, 'Exame clínico': 1.2 }, is_required: true },
    { question: 'Tipo de animal?', field_type: 'RADIO', options: ['Cão', 'Gato', 'Pássaro', 'Roedor', 'Réptil', 'Outro'], affects_price: true, price_modifier: { 'Cão': 1, 'Gato': 1, 'Pássaro': 1.1, 'Roedor': 0.9, 'Réptil': 1.3 }, is_required: true },
    { question: 'Descreva o motivo da consulta', field_type: 'TEXTAREA', is_required: true, placeholder: 'Ex: o animal está sem apetite há 2 dias, vomitando...' },
    { question: 'O animal está com carteirinha de vacinação? (se consulta)', field_type: 'BOOLEAN', is_required: false },
  ])

  const adestramento = await upsertCategory({
    group_id: pet.id,
    name: 'Adestramento',
    slug: 'adestramento',
    icon: '🐕',
    description: 'Treinamento comportamental e adestramento de cães',
    base_price_min: 100,
    base_price_max: 400,
    estimated_hours: 1,
  })
  await createQuestionnaire(adestramento.id, [
    { question: 'Objetivo do treinamento?', field_type: 'SELECT', options: ['Comandos básicos (senta, deita, fica)', 'Eliminar comportamento agressivo', 'Parar de latir excessivamente', 'Socialização com pessoas/animais', 'Eliminação fora do lugar certo', 'Ansiedade de separação', 'Treinamento avançado/obediência'], affects_price: true, price_modifier: { 'Comandos básicos (senta, deita, fica)': 1, 'Eliminar comportamento agressivo': 1.5, 'Treinamento avançado/obediência': 1.3 }, is_required: true },
    { question: 'Porte do cão?', field_type: 'RADIO', options: ['Pequeno (até 10kg)', 'Médio (10-25kg)', 'Grande (acima de 25kg)'], affects_price: true, price_modifier: { 'Pequeno (até 10kg)': 1, 'Médio (10-25kg)': 1.1, 'Grande (acima de 25kg)': 1.2 }, is_required: true },
    { question: 'Idade do cão?', field_type: 'RADIO', options: ['Filhote (até 6 meses)', '6 meses - 2 anos', 'Adulto (2-7 anos)', 'Sênior (acima de 7 anos)'], affects_price: false, is_required: true },
    { question: 'Quantas sessões você deseja contratar?', field_type: 'SELECT', options: ['1 sessão (avaliação)', '4 sessões (pacote básico)', '8 sessões', '12 sessões ou mais'], affects_price: true, price_modifier: { '1 sessão (avaliação)': 1, '4 sessões (pacote básico)': 3.5, '8 sessões': 6.5, '12 sessões ou mais': 9 }, is_required: true },
  ])

  const hotelPet = await upsertCategory({
    group_id: pet.id,
    name: 'Hotel para Pets / Day Care',
    slug: 'hotel-pet',
    icon: '🏡',
    description: 'Hospedagem e creche diurna para cães e gatos',
    base_price_min: 50,
    base_price_max: 200,
    estimated_hours: 24,
  })
  await createQuestionnaire(hotelPet.id, [
    { question: 'Tipo de serviço?', field_type: 'RADIO', options: ['Day care (diário, sem pernoite)', 'Hospedagem (com pernoite)', 'Final de semana completo', 'Semana inteira ou mais'], affects_price: true, price_modifier: { 'Day care (diário, sem pernoite)': 0.6, 'Hospedagem (com pernoite)': 1, 'Final de semana completo': 1.8, 'Semana inteira ou mais': 4 }, is_required: true },
    { question: 'Tipo de animal?', field_type: 'RADIO', options: ['Cão', 'Gato', 'Outro'], affects_price: false, is_required: true },
    { question: 'Porte do animal?', field_type: 'SELECT', options: ['Mini (até 5kg)', 'Pequeno (5-10kg)', 'Médio (10-20kg)', 'Grande (20-40kg)', 'Gigante (acima de 40kg)'], affects_price: true, price_modifier: { 'Mini (até 5kg)': 0.8, 'Pequeno (5-10kg)': 1, 'Médio (10-20kg)': 1.3, 'Grande (20-40kg)': 1.6, 'Gigante (acima de 40kg)': 2 }, is_required: true },
    { question: 'O animal tem vacinas em dia?', field_type: 'BOOLEAN', is_required: true, help_text: 'V8/V10 e antirrábica são obrigatórias na maioria dos hotéis' },
    { question: 'O animal convive bem com outros animais?', field_type: 'BOOLEAN', is_required: true },
    { question: 'Precisa de banho e tosa na saída?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.3, 'false': 1 }, is_required: true },
    { question: 'Foto do pet', field_type: 'PHOTO', is_required: false },
  ])

  const transportePet = await upsertCategory({
    group_id: pet.id,
    name: 'Transporte de Pets',
    slug: 'transporte-pet',
    icon: '🚗',
    description: 'Busca e entrega de pets em clínicas, petshops e eventos',
    base_price_min: 40,
    base_price_max: 200,
    estimated_hours: 1,
  })
  await createQuestionnaire(transportePet.id, [
    { question: 'Finalidade do transporte?', field_type: 'SELECT', options: ['Ir ao veterinário', 'Ir ao petshop (banho/tosa)', 'Buscar no canil/hotel', 'Mudança/transporte geral', 'Outro'], affects_price: false, is_required: true },
    { question: 'Porte do animal?', field_type: 'SELECT', options: ['Pequeno (até 10kg)', 'Médio (10-25kg)', 'Grande (acima de 25kg)'], affects_price: true, price_modifier: { 'Pequeno (até 10kg)': 1, 'Médio (10-25kg)': 1.2, 'Grande (acima de 25kg)': 1.5 }, is_required: true },
    { question: 'Distância estimada (ida)?', field_type: 'SELECT', options: ['Até 5km', '5-15km', '15-30km', 'Acima de 30km'], affects_price: true, price_modifier: { 'Até 5km': 0.7, '5-15km': 1, '15-30km': 1.5, 'Acima de 30km': 2.5 }, is_required: true },
    { question: 'Precisa de ida e volta?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.7, 'false': 1 }, is_required: true },
  ])

  console.log('✅ Categorias "Para Seu Pet" criadas')

  // ---------- TECH E DIGITAL ----------

  const consertoPc = await upsertCategory({
    group_id: tech.id,
    name: 'Conserto de Computador / Notebook',
    slug: 'conserto-computador',
    icon: '💻',
    description: 'Manutenção e reparo de computadores e notebooks',
    base_price_min: 80,
    base_price_max: 300,
    estimated_hours: 2,
  })
  await createQuestionnaire(consertoPc.id, [
    { question: 'Tipo de equipamento?', field_type: 'RADIO', options: ['Computador (desktop)', 'Notebook', 'All-in-one', 'Tablet'], affects_price: false, is_required: true },
    { question: 'Qual o problema?', field_type: 'SELECT', options: ['Computador lento', 'Não liga', 'Vírus/malware', 'Tela quebrada', 'Teclado/mouse com problema', 'Superaquecimento', 'HD/SSD cheio ou com problema', 'Instalação de Windows/Software', 'Upgrade de memória/HD'], affects_price: true, price_modifier: { 'Tela quebrada': 1.5, 'Não liga': 1.3, 'Instalação de Windows/Software': 0.8 }, is_required: true },
    { question: 'O atendimento será em domicílio ou você leva o equipamento?', field_type: 'RADIO', options: ['Em domicílio', 'Levo ao profissional'], affects_price: true, price_modifier: { 'Em domicílio': 1.3, 'Levo ao profissional': 1 }, is_required: true },
    { question: 'Foto do equipamento e/ou tela de erro', field_type: 'PHOTO', is_required: false },
  ])

  const redeWifi = await upsertCategory({
    group_id: tech.id,
    name: 'Configuração de Rede Wi-Fi',
    slug: 'rede-wifi',
    icon: '📡',
    description: 'Configuração, ampliação e suporte de redes Wi-Fi',
    base_price_min: 80,
    base_price_max: 250,
    estimated_hours: 1,
  })
  await createQuestionnaire(redeWifi.id, [
    { question: 'Qual o problema/serviço?', field_type: 'SELECT', options: ['Wi-Fi fraco/sem sinal', 'Configurar roteador novo', 'Instalar repetidor', 'Criar rede corporativa', 'Diagnóstico de rede lenta', 'Cabeamento de rede (cabo)'], affects_price: true, price_modifier: { 'Criar rede corporativa': 2, 'Cabeamento de rede (cabo)': 1.8 }, is_required: true },
    { question: 'Quantos cômodos/andares precisam de sinal?', field_type: 'SELECT', options: ['1-2 cômodos', '3-5 cômodos', '6-10 cômodos', 'Casa/empresa grande'], affects_price: true, price_modifier: { '1-2 cômodos': 1, '3-5 cômodos': 1.3, '6-10 cômodos': 1.8, 'Casa/empresa grande': 2.5 }, is_required: true },
  ])

  const instalacaoTv = await upsertCategory({
    group_id: tech.id,
    name: 'Instalação de TV / Home Theater',
    slug: 'instalacao-tv',
    icon: '📺',
    description: 'Fixação de TV na parede, suporte e configuração de home theater',
    base_price_min: 80,
    base_price_max: 300,
    estimated_hours: 1,
  })
  await createQuestionnaire(instalacaoTv.id, [
    { question: 'Tipo de serviço?', field_type: 'SELECT', options: ['Fixar TV na parede', 'Instalar home theater/soundbar', 'Organizar/esconder fiação', 'Configurar smart TV/streaming', 'Montar rack/móvel de TV', 'Instalar projetor'], affects_price: true, price_modifier: { 'Fixar TV na parede': 1, 'Instalar home theater/soundbar': 1.3, 'Instalar projetor': 1.5, 'Montar rack/móvel de TV': 0.8 }, is_required: true },
    { question: 'Tamanho da TV?', field_type: 'SELECT', options: ['Até 40"', '40"-55"', '55"-70"', 'Acima de 70"', 'Não se aplica'], affects_price: true, price_modifier: { 'Até 40"': 0.8, '40"-55"': 1, '55"-70"': 1.2, 'Acima de 70"': 1.5 }, is_required: true },
    { question: 'Tipo de parede?', field_type: 'RADIO', options: ['Concreto/alvenaria', 'Drywall/gesso', 'Madeira', 'Não sei'], affects_price: true, price_modifier: { 'Concreto/alvenaria': 1, 'Drywall/gesso': 1.2, 'Madeira': 0.9 }, is_required: true },
    { question: 'Foto do local onde a TV será instalada', field_type: 'PHOTO', is_required: false },
  ])

  const camerasCCTV = await upsertCategory({
    group_id: tech.id,
    name: 'Câmeras de Segurança (CCTV)',
    slug: 'cameras-seguranca',
    icon: '📷',
    description: 'Instalação e configuração de câmeras de monitoramento',
    base_price_min: 150,
    base_price_max: 1000,
    estimated_hours: 3,
  })
  await createQuestionnaire(camerasCCTV.id, [
    { question: 'Tipo de instalação?', field_type: 'RADIO', options: ['Câmeras novas (já compradas)', 'Câmeras novas (preciso indicação)', 'Manutenção/substituição de câmera', 'Configurar acesso remoto pelo celular'], affects_price: true, price_modifier: { 'Câmeras novas (já compradas)': 1, 'Câmeras novas (preciso indicação)': 1.2, 'Manutenção/substituição de câmera': 0.7, 'Configurar acesso remoto pelo celular': 0.5 }, is_required: true },
    { question: 'Quantas câmeras?', field_type: 'SELECT', options: ['1-2 câmeras', '3-4 câmeras', '5-8 câmeras', 'Mais de 8 câmeras'], affects_price: true, price_modifier: { '1-2 câmeras': 1, '3-4 câmeras': 1.8, '5-8 câmeras': 3, 'Mais de 8 câmeras': 5 }, is_required: true },
    { question: 'Local de instalação?', field_type: 'RADIO', options: ['Residência', 'Comércio/escritório', 'Condomínio', 'Área externa (poste/muro)'], affects_price: true, price_modifier: { 'Residência': 1, 'Comércio/escritório': 1.2, 'Condomínio': 1.5, 'Área externa (poste/muro)': 1.4 }, is_required: true },
    { question: 'Foto do local de instalação', field_type: 'PHOTO', is_required: false },
  ])

  const recuperacaoDados = await upsertCategory({
    group_id: tech.id,
    name: 'Recuperação de Dados',
    slug: 'recuperacao-dados',
    icon: '💾',
    description: 'Recuperação de arquivos deletados, HD com defeito e celular',
    base_price_min: 150,
    base_price_max: 800,
    estimated_hours: 3,
  })
  await createQuestionnaire(recuperacaoDados.id, [
    { question: 'Tipo de dispositivo?', field_type: 'SELECT', options: ['HD externo', 'HD interno (notebook/PC)', 'SSD', 'Pendrive/Cartão de memória', 'Celular/Tablet', 'RAID/Servidor'], affects_price: true, price_modifier: { 'HD externo': 1, 'HD interno (notebook/PC)': 1.2, 'SSD': 1.5, 'Pendrive/Cartão de memória': 0.6, 'Celular/Tablet': 1.3, 'RAID/Servidor': 3 }, is_required: true },
    { question: 'Causa do problema?', field_type: 'RADIO', options: ['Arquivos deletados acidentalmente', 'Formatação acidental', 'HD/SSD com defeito físico', 'Vírus/ransomware', 'Dano por queda d\'água/físico'], affects_price: true, price_modifier: { 'Arquivos deletados acidentalmente': 1, 'Formatação acidental': 1.2, 'HD/SSD com defeito físico': 2, 'Vírus/ransomware': 1.5, 'Dano por queda d\'água/físico': 2.5 }, is_required: true },
    { question: 'Qual a urgência?', field_type: 'RADIO', options: ['Urgente (24h)', 'Normal (3-5 dias)', 'Sem pressa (1-2 semanas)'], affects_price: true, price_modifier: { 'Urgente (24h)': 1.8, 'Normal (3-5 dias)': 1, 'Sem pressa (1-2 semanas)': 0.8 }, is_required: true },
    { question: 'Descreva quais arquivos são importantes recuperar', field_type: 'TEXTAREA', is_required: true, placeholder: 'Ex: fotos da minha filha, documentos de trabalho em formato .docx, pasta "Projetos 2024"' },
  ])

  const suporteRemoto = await upsertCategory({
    group_id: tech.id,
    name: 'Suporte de TI / Helpdesk',
    slug: 'suporte-ti',
    icon: '🖥️',
    description: 'Suporte técnico remoto ou presencial para empresas e domicílios',
    base_price_min: 60,
    base_price_max: 300,
    estimated_hours: 1,
  })
  await createQuestionnaire(suporteRemoto.id, [
    { question: 'Tipo de suporte?', field_type: 'SELECT', options: ['Configurar e-mail corporativo', 'Instalar/configurar impressora', 'Configurar VPN', 'Problema com Office/Windows', 'Backup e nuvem (Google Drive, OneDrive)', 'Configurar celular corporativo', 'Outro suporte técnico'], affects_price: true, price_modifier: { 'Configurar VPN': 1.3, 'Backup e nuvem (Google Drive, OneDrive)': 1, 'Outro suporte técnico': 1 }, is_required: true },
    { question: 'Modalidade do atendimento?', field_type: 'RADIO', options: ['Remoto (acesso via internet)', 'Presencial em domicílio', 'Presencial na empresa'], affects_price: true, price_modifier: { 'Remoto (acesso via internet)': 0.7, 'Presencial em domicílio': 1, 'Presencial na empresa': 1.2 }, is_required: true },
    { question: 'Descreva o problema', field_type: 'TEXTAREA', is_required: true, placeholder: 'Ex: minha impressora HP aparece offline mas está ligada...' },
  ])

  console.log('✅ Categorias "Tech e Digital" criadas')

  // ---------- ENTREGAS E LOGÍSTICA ----------

  const freteTransporte = await upsertCategory({
    group_id: entregas.id,
    name: 'Frete e Transporte',
    slug: 'frete-transporte',
    icon: '🚚',
    description: 'Carreto, mudanças e transporte de itens',
    base_price_min: 100,
    base_price_max: 1500,
    estimated_hours: 3,
  })
  await createQuestionnaire(freteTransporte.id, [
    { question: 'Tipo de serviço?', field_type: 'RADIO', options: ['Mudança completa', 'Mudança parcial', 'Carreto simples', 'Transporte de móvel único', 'Entrega de produto grande'], affects_price: true, price_modifier: { 'Mudança completa': 3, 'Mudança parcial': 2, 'Carreto simples': 1, 'Transporte de móvel único': 0.8 }, is_required: true },
    { question: 'Distância aproximada?', field_type: 'SELECT', options: ['Dentro do mesmo bairro', 'Mesma cidade (até 20km)', 'Mesma cidade (20-50km)', 'Outra cidade'], affects_price: true, price_modifier: { 'Dentro do mesmo bairro': 1, 'Mesma cidade (até 20km)': 1.2, 'Mesma cidade (20-50km)': 1.6, 'Outra cidade': 2.5 }, is_required: true },
    { question: 'Precisa de ajudante para carga/descarga?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.4, 'false': 1 }, is_required: true },
    { question: 'Há escada? Quantos andares?', field_type: 'SELECT', options: ['Não (térreo)', '1 andar', '2 andares', '3+ andares', 'Tem elevador'], affects_price: true, price_modifier: { 'Não (térreo)': 1, '1 andar': 1.2, '2 andares': 1.4, '3+ andares': 1.7, 'Tem elevador': 1.1 }, is_required: true },
    { question: 'Foto dos itens a transportar', field_type: 'PHOTO', is_required: true },
  ])

  const motoboy = await upsertCategory({
    group_id: entregas.id,
    name: 'Motoboy / Entrega Rápida',
    slug: 'motoboy',
    icon: '🏍️',
    description: 'Entregas expressas, documentos e pequenos volumes na cidade',
    base_price_min: 20,
    base_price_max: 150,
    estimated_hours: 1,
  })
  await createQuestionnaire(motoboy.id, [
    { question: 'O que será entregue?', field_type: 'SELECT', options: ['Documento/envelope', 'Encomenda pequena (cabe numa mochila)', 'Encomenda média', 'Comida/refeição', 'Medicamento/farmácia', 'Chave/objeto pessoal', 'Outro'], affects_price: false, is_required: true },
    { question: 'Quantas paradas/endereços?', field_type: 'SELECT', options: ['1 entrega (origem → destino)', '2 paradas', '3-5 paradas', 'Rota com muitas paradas'], affects_price: true, price_modifier: { '1 entrega (origem → destino)': 1, '2 paradas': 1.5, '3-5 paradas': 2.5, 'Rota com muitas paradas': 4 }, is_required: true },
    { question: 'Distância total estimada?', field_type: 'SELECT', options: ['Até 5km', '5-15km', '15-30km', 'Acima de 30km'], affects_price: true, price_modifier: { 'Até 5km': 0.7, '5-15km': 1, '15-30km': 1.5, 'Acima de 30km': 2.5 }, is_required: true },
    { question: 'É urgente? (precisa em até 1h)', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.4, 'false': 1 }, is_required: true },
  ])

  const comprasRecados = await upsertCategory({
    group_id: entregas.id,
    name: 'Compras e Recados',
    slug: 'compras-recados',
    icon: '🛒',
    description: 'Fazer compras no mercado, farmácia e outros recados',
    base_price_min: 30,
    base_price_max: 150,
    estimated_hours: 1,
  })
  await createQuestionnaire(comprasRecados.id, [
    { question: 'Tipo de serviço?', field_type: 'SELECT', options: ['Compras no supermercado', 'Ir à farmácia', 'Pagar contas/boletos', 'Buscar encomenda/correios', 'Compras em loja específica', 'Recado geral (ir a um lugar)'], affects_price: false, is_required: true },
    { question: 'Valor estimado das compras (se aplicável)?', field_type: 'SELECT', options: ['Até R$ 50', 'R$ 50-150', 'R$ 150-300', 'Acima de R$ 300', 'Não há compras (só recado)'], affects_price: false, is_required: false, help_text: 'O pagamento das compras é feito separadamente pelo cliente' },
    { question: 'Quantos locais diferentes?', field_type: 'SELECT', options: ['1 local', '2 locais', '3 ou mais locais'], affects_price: true, price_modifier: { '1 local': 1, '2 locais': 1.5, '3 ou mais locais': 2 }, is_required: true },
  ])

  console.log('✅ Categorias "Entregas e Logística" criadas')

  // ---------- EVENTOS E FESTAS ----------

  const fotografiaEventos = await upsertCategory({
    group_id: eventos.id,
    name: 'Fotografia e Filmagem',
    slug: 'fotografia-filmagem',
    icon: '📸',
    description: 'Cobertura fotográfica e de vídeo para eventos',
    base_price_min: 200,
    base_price_max: 3000,
    estimated_hours: 4,
  })
  await createQuestionnaire(fotografiaEventos.id, [
    { question: 'Tipo de evento?', field_type: 'SELECT', options: ['Aniversário', 'Casamento', 'Formatura', 'Chá de bebê/revelação', 'Corporativo/empresarial', 'Ensaio fotográfico', 'Batizado/comunhão', 'Outro'], affects_price: true, price_modifier: { 'Casamento': 2.5, 'Formatura': 1.5, 'Ensaio fotográfico': 0.8, 'Aniversário': 1 }, is_required: true },
    { question: 'Duração do evento?', field_type: 'SELECT', options: ['Até 2 horas', '2-4 horas', '4-6 horas', '6-8 horas', 'Dia inteiro'], affects_price: true, price_modifier: { 'Até 2 horas': 0.5, '2-4 horas': 1, '4-6 horas': 1.5, '6-8 horas': 2, 'Dia inteiro': 2.8 }, is_required: true },
    { question: 'Precisa de filmagem além de fotos?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.6, 'false': 1 }, is_required: true },
    { question: 'Número estimado de convidados?', field_type: 'SELECT', options: ['Até 20', '20-50', '50-100', '100-200', 'Acima de 200'], affects_price: true, price_modifier: { 'Até 20': 0.8, '20-50': 1, '50-100': 1.2, '100-200': 1.4, 'Acima de 200': 1.7 }, is_required: true },
    { question: 'Referência de estilo fotográfico', field_type: 'PHOTO', is_required: false },
  ])

  const chefParticular = await upsertCategory({
    group_id: eventos.id,
    name: 'Cozinheiro / Chef Particular',
    slug: 'chef-particular',
    icon: '👨‍🍳',
    description: 'Chef para eventos, jantares e refeições especiais',
    base_price_min: 150,
    base_price_max: 1500,
    estimated_hours: 4,
  })
  await createQuestionnaire(chefParticular.id, [
    { question: 'Tipo de serviço?', field_type: 'RADIO', options: ['Jantar romântico', 'Festa/evento', 'Churrasco', 'Refeições semanais', 'Buffet completo'], affects_price: true, price_modifier: { 'Jantar romântico': 1, 'Festa/evento': 1.5, 'Churrasco': 1.2, 'Refeições semanais': 0.8, 'Buffet completo': 2.5 }, is_required: true },
    { question: 'Para quantas pessoas?', field_type: 'SELECT', options: ['2-4 pessoas', '5-10 pessoas', '10-20 pessoas', '20-50 pessoas', 'Acima de 50'], affects_price: true, price_modifier: { '2-4 pessoas': 1, '5-10 pessoas': 1.5, '10-20 pessoas': 2.5, '20-50 pessoas': 4, 'Acima de 50': 6 }, is_required: true },
    { question: 'Os ingredientes serão fornecidos pelo profissional?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.5, 'false': 1 }, is_required: true },
    { question: 'Alguma restrição alimentar (alergia, vegetariano, etc.)?', field_type: 'TEXT', is_required: false, placeholder: 'Ex: sem glúten, vegetariano, alergia a frutos do mar' },
  ])

  const djSonorizacao = await upsertCategory({
    group_id: eventos.id,
    name: 'DJ e Sonorização',
    slug: 'dj-sonorizacao',
    icon: '🎧',
    description: 'DJ profissional e locação de equipamentos de som para festas',
    base_price_min: 300,
    base_price_max: 3000,
    estimated_hours: 4,
  })
  await createQuestionnaire(djSonorizacao.id, [
    { question: 'Tipo de evento?', field_type: 'SELECT', options: ['Aniversário/festa particular', 'Casamento', 'Corporativo/confraternização', 'Formatura', 'Open bar/balada', 'Evento ao ar livre'], affects_price: true, price_modifier: { 'Aniversário/festa particular': 1, 'Casamento': 1.8, 'Corporativo/confraternização': 1.3, 'Formatura': 1.5, 'Open bar/balada': 2 }, is_required: true },
    { question: 'Duração do serviço?', field_type: 'SELECT', options: ['2 horas', '3-4 horas', '5-6 horas', '7-8 horas', 'Noite inteira (acima de 8h)'], affects_price: true, price_modifier: { '2 horas': 0.5, '3-4 horas': 1, '5-6 horas': 1.4, '7-8 horas': 1.8, 'Noite inteira (acima de 8h)': 2.5 }, is_required: true },
    { question: 'Precisa de estrutura de som (caixas, amplificadores)?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.5, 'false': 1 }, is_required: true },
    { question: 'Precisa de iluminação (moving heads, canhão de luz)?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.3, 'false': 1 }, is_required: true },
    { question: 'Número estimado de convidados?', field_type: 'SELECT', options: ['Até 30', '30-100', '100-300', 'Acima de 300'], affects_price: true, price_modifier: { 'Até 30': 0.8, '30-100': 1, '100-300': 1.4, 'Acima de 300': 2 }, is_required: true },
  ])

  const decoracaoFestas = await upsertCategory({
    group_id: eventos.id,
    name: 'Decoração de Festas',
    slug: 'decoracao-festas',
    icon: '🎈',
    description: 'Decoração completa para aniversários, casamentos e eventos',
    base_price_min: 200,
    base_price_max: 5000,
    estimated_hours: 4,
  })
  await createQuestionnaire(decoracaoFestas.id, [
    { question: 'Tipo de evento?', field_type: 'SELECT', options: ['Aniversário infantil', 'Aniversário adulto', 'Casamento', 'Chá de bebê/revelação', 'Formatura', 'Corporativo', 'Outro'], affects_price: true, price_modifier: { 'Aniversário infantil': 1, 'Aniversário adulto': 1, 'Casamento': 2.5, 'Chá de bebê/revelação': 1.2, 'Formatura': 1.5 }, is_required: true },
    { question: 'Tamanho do espaço a decorar?', field_type: 'SELECT', options: ['Pequeno (residência, até 30 pessoas)', 'Médio (salão, 30-100 pessoas)', 'Grande (100-300 pessoas)', 'Muito grande (acima de 300 pessoas)'], affects_price: true, price_modifier: { 'Pequeno (residência, até 30 pessoas)': 1, 'Médio (salão, 30-100 pessoas)': 2, 'Grande (100-300 pessoas)': 4, 'Muito grande (acima de 300 pessoas)': 7 }, is_required: true },
    { question: 'Os materiais de decoração serão fornecidos pelo decorador?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.6, 'false': 1 }, is_required: true },
    { question: 'Tema da decoração', field_type: 'TEXT', is_required: false, placeholder: 'Ex: Safari, Frozen, Jardim Encantado, Preto e Dourado' },
    { question: 'Foto de referência de decoração', field_type: 'PHOTO', is_required: false },
  ])

  const garcomBartender = await upsertCategory({
    group_id: eventos.id,
    name: 'Garçom / Bartender',
    slug: 'garcom-bartender',
    icon: '🍸',
    description: 'Garçons e bartenders para festas, eventos e confraternizações',
    base_price_min: 150,
    base_price_max: 1500,
    estimated_hours: 5,
  })
  await createQuestionnaire(garcomBartender.id, [
    { question: 'Tipo de profissional?', field_type: 'RADIO', options: ['Garçom (serviço de mesa)', 'Bartender (drinks/côcteis)', 'Copeiro (passagem de bandeja)', 'Garçom + Bartender'], affects_price: true, price_modifier: { 'Garçom (serviço de mesa)': 1, 'Bartender (drinks/côcteis)': 1.3, 'Copeiro (passagem de bandeja)': 0.9, 'Garçom + Bartender': 2 }, is_required: true },
    { question: 'Quantos profissionais?', field_type: 'SELECT', options: ['1 profissional', '2 profissionais', '3-4 profissionais', '5 ou mais'], affects_price: true, price_modifier: { '1 profissional': 1, '2 profissionais': 1.9, '3-4 profissionais': 3.5, '5 ou mais': 5.5 }, is_required: true },
    { question: 'Duração do evento?', field_type: 'SELECT', options: ['3 horas', '4-5 horas', '6-8 horas', 'Mais de 8 horas'], affects_price: true, price_modifier: { '3 horas': 0.7, '4-5 horas': 1, '6-8 horas': 1.4, 'Mais de 8 horas': 1.8 }, is_required: true },
    { question: 'Número de convidados?', field_type: 'SELECT', options: ['Até 20', '20-50', '50-100', '100-200', 'Acima de 200'], affects_price: false, is_required: true },
  ])

  const animacaoInfantil = await upsertCategory({
    group_id: eventos.id,
    name: 'Animação Infantil / Recreação',
    slug: 'animacao-infantil',
    icon: '🤡',
    description: 'Animadores, recreadores e personagens para festas infantis',
    base_price_min: 150,
    base_price_max: 800,
    estimated_hours: 2,
  })
  await createQuestionnaire(animacaoInfantil.id, [
    { question: 'Tipo de serviço?', field_type: 'SELECT', options: ['Recreação em geral', 'Palhaço', 'Personagem fantasiado (Frozen, Super-Heróis, etc.)', 'Mágico', 'Pintura facial', 'Contação de histórias', 'Animação + brincadeiras organizadas'], affects_price: true, price_modifier: { 'Recreação em geral': 1, 'Palhaço': 1.1, 'Personagem fantasiado (Frozen, Super-Heróis, etc.)': 1.3, 'Mágico': 1.4 }, is_required: true },
    { question: 'Duração da animação?', field_type: 'RADIO', options: ['1 hora', '2 horas', '3 horas', '4 horas ou mais'], affects_price: true, price_modifier: { '1 hora': 0.6, '2 horas': 1, '3 horas': 1.4, '4 horas ou mais': 1.8 }, is_required: true },
    { question: 'Faixa etária das crianças?', field_type: 'SELECT', options: ['Bebês e crianças (0-3 anos)', 'Crianças (3-7 anos)', 'Crianças (7-12 anos)', 'Misto'], affects_price: false, is_required: true },
    { question: 'Quantidade estimada de crianças?', field_type: 'SELECT', options: ['Até 10', '10-25', '25-50', 'Mais de 50'], affects_price: true, price_modifier: { 'Até 10': 1, '10-25': 1.2, '25-50': 1.5, 'Mais de 50': 2 }, is_required: true },
  ])

  console.log('✅ Categorias "Eventos e Festas" criadas')

  // ---------- EDUCAÇÃO E AULAS ----------

  const aulasParticulares = await upsertCategory({
    group_id: educacao.id,
    name: 'Aulas Particulares',
    slug: 'aulas-particulares',
    icon: '📐',
    description: 'Aulas de reforço e particulares para todas as matérias',
    base_price_min: 60,
    base_price_max: 200,
    estimated_hours: 1,
  })
  await createQuestionnaire(aulasParticulares.id, [
    { question: 'Qual matéria/disciplina?', field_type: 'SELECT', options: ['Matemática', 'Português', 'Inglês', 'Espanhol', 'Física', 'Química', 'Biologia', 'História', 'Geografia', 'Redação', 'ENEM/Vestibular', 'Concursos Públicos', 'Outra'], affects_price: true, price_modifier: { 'Inglês': 1.2, 'Espanhol': 1.1, 'ENEM/Vestibular': 1.3, 'Concursos Públicos': 1.4 }, is_required: true },
    { question: 'Nível escolar?', field_type: 'SELECT', options: ['Fundamental I (1º-5º)', 'Fundamental II (6º-9º)', 'Ensino Médio', 'Pré-vestibular', 'Graduação/Superior', 'Adultos'], affects_price: true, price_modifier: { 'Fundamental I (1º-5º)': 0.8, 'Graduação/Superior': 1.5 }, is_required: true },
    { question: 'Modalidade?', field_type: 'RADIO', options: ['Presencial (na minha casa)', 'Presencial (na casa do professor)', 'Online (videoconferência)'], affects_price: true, price_modifier: { 'Presencial (na minha casa)': 1.2, 'Presencial (na casa do professor)': 1, 'Online (videoconferência)': 0.85 }, is_required: true },
    { question: 'Frequência das aulas?', field_type: 'RADIO', options: ['1x por semana', '2x por semana', '3x por semana', 'Intensivo diário'], affects_price: false, is_required: true },
  ])

  const aulasMusica = await upsertCategory({
    group_id: educacao.id,
    name: 'Aulas de Música',
    slug: 'aulas-musica',
    icon: '🎵',
    description: 'Aulas de violão, piano, teclado, canto, bateria e mais',
    base_price_min: 60,
    base_price_max: 200,
    estimated_hours: 1,
  })
  await createQuestionnaire(aulasMusica.id, [
    { question: 'Instrumento?', field_type: 'SELECT', options: ['Violão/Guitarra', 'Piano/Teclado', 'Bateria/Percussão', 'Canto/Voz', 'Flauta/Saxofone', 'Violino', 'Baixo', 'Cavaquinho/Ukulele', 'Outro'], affects_price: true, price_modifier: { 'Bateria/Percussão': 1.2, 'Piano/Teclado': 1.1, 'Violino': 1.2 }, is_required: true },
    { question: 'Nível atual?', field_type: 'RADIO', options: ['Iniciante (nunca toquei)', 'Básico (conheço o instrumento)', 'Intermediário', 'Avançado (quero me aperfeiçoar)'], affects_price: false, is_required: true },
    { question: 'Modalidade?', field_type: 'RADIO', options: ['Presencial (professor vem até mim)', 'Presencial (vou até o professor)', 'Online (videoconferência)'], affects_price: true, price_modifier: { 'Presencial (professor vem até mim)': 1.2, 'Presencial (vou até o professor)': 1, 'Online (videoconferência)': 0.8 }, is_required: true },
    { question: 'O instrumento já está disponível?', field_type: 'BOOLEAN', is_required: true, help_text: 'Se não, o professor pode indicar onde comprar ou alugar' },
  ])

  const aulasIdiomas = await upsertCategory({
    group_id: educacao.id,
    name: 'Aulas de Idiomas',
    slug: 'aulas-idiomas',
    icon: '🌍',
    description: 'Inglês, espanhol, francês, alemão e outros idiomas',
    base_price_min: 60,
    base_price_max: 250,
    estimated_hours: 1,
  })
  await createQuestionnaire(aulasIdiomas.id, [
    { question: 'Idioma?', field_type: 'SELECT', options: ['Inglês', 'Espanhol', 'Francês', 'Alemão', 'Italiano', 'Mandarim', 'Japonês', 'Português para estrangeiros', 'Libras (Língua de Sinais)', 'Outro'], affects_price: true, price_modifier: { 'Inglês': 1, 'Mandarim': 1.5, 'Japonês': 1.4, 'Libras (Língua de Sinais)': 1.2 }, is_required: true },
    { question: 'Nível atual no idioma?', field_type: 'RADIO', options: ['Básico (iniciante)', 'Elementar (A2)', 'Intermediário (B1-B2)', 'Avançado (C1-C2)', 'Conversação avançada'], affects_price: false, is_required: true },
    { question: 'Objetivo principal?', field_type: 'SELECT', options: ['Conversação do dia a dia', 'Viagens', 'Trabalho/negócios', 'Preparação para prova (TOEFL, IELTS, DELF)', 'Imigração', 'Acadêmico'], affects_price: false, is_required: true },
    { question: 'Modalidade?', field_type: 'RADIO', options: ['Presencial (na minha casa)', 'Online (videoconferência)', 'Escola/estúdio do professor'], affects_price: true, price_modifier: { 'Presencial (na minha casa)': 1.2, 'Online (videoconferência)': 0.85, 'Escola/estúdio do professor': 1 }, is_required: true },
  ])

  const aulasDanca = await upsertCategory({
    group_id: educacao.id,
    name: 'Aulas de Dança',
    slug: 'aulas-danca',
    icon: '💃',
    description: 'Ballet, funk, forró, samba, zumba e outros estilos',
    base_price_min: 60,
    base_price_max: 200,
    estimated_hours: 1,
  })
  await createQuestionnaire(aulasDanca.id, [
    { question: 'Estilo de dança?', field_type: 'SELECT', options: ['Ballet clássico', 'Jazz/Contemporâneo', 'Forró', 'Samba/Pagode', 'Funk', 'Salsa/Zouk', 'Zumba/Fitness dance', 'Hip-hop/Street dance', 'Dança de salão', 'K-pop'], affects_price: false, is_required: true },
    { question: 'Nível atual?', field_type: 'RADIO', options: ['Iniciante', 'Básico', 'Intermediário', 'Avançado'], affects_price: false, is_required: true },
    { question: 'Para quem é a aula?', field_type: 'RADIO', options: ['Individual (1 pessoa)', 'Dupla (casal)', 'Grupo pequeno (3-6 pessoas)'], affects_price: true, price_modifier: { 'Individual (1 pessoa)': 1, 'Dupla (casal)': 1.5, 'Grupo pequeno (3-6 pessoas)': 2.5 }, is_required: true },
    { question: 'Modalidade?', field_type: 'RADIO', options: ['Presencial (professor vem a mim)', 'Presencial (em estúdio)', 'Online'], affects_price: true, price_modifier: { 'Presencial (professor vem a mim)': 1.3, 'Presencial (em estúdio)': 1, 'Online': 0.7 }, is_required: true },
  ])

  const aulasCulinaria = await upsertCategory({
    group_id: educacao.id,
    name: 'Aulas de Culinária',
    slug: 'aulas-culinaria',
    icon: '🍳',
    description: 'Aulas particulares de culinária, confeitaria e gastronomia',
    base_price_min: 80,
    base_price_max: 300,
    estimated_hours: 2,
  })
  await createQuestionnaire(aulasCulinaria.id, [
    { question: 'Tipo de culinária?', field_type: 'SELECT', options: ['Culinária brasileira', 'Confeitaria/bolos', 'Culinária italiana/massas', 'Sushi/japonesa', 'Culinária saudável', 'Churrasco', 'Pães e panificação', 'Bebidas/côcteis', 'Vegetariana/vegana'], affects_price: false, is_required: true },
    { question: 'Para quantas pessoas é a aula?', field_type: 'RADIO', options: ['1 pessoa', '2-3 pessoas', '4-6 pessoas'], affects_price: true, price_modifier: { '1 pessoa': 1, '2-3 pessoas': 1.4, '4-6 pessoas': 2 }, is_required: true },
    { question: 'Os ingredientes serão fornecidos pelo professor?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.4, 'false': 1 }, is_required: true },
    { question: 'Você tem alguma restrição alimentar?', field_type: 'TEXT', is_required: false, placeholder: 'Ex: alergia a lactose, vegetariano' },
  ])

  const aulasInformatica = await upsertCategory({
    group_id: educacao.id,
    name: 'Aulas de Informática',
    slug: 'aulas-informatica',
    icon: '🖱️',
    description: 'Informática básica, Excel, Word, internet e redes sociais',
    base_price_min: 50,
    base_price_max: 150,
    estimated_hours: 1,
  })
  await createQuestionnaire(aulasInformatica.id, [
    { question: 'O que deseja aprender?', field_type: 'SELECT', options: ['Informática básica (ligar/usar o computador)', 'Internet e e-mail', 'Pacote Office (Word, Excel, PowerPoint)', 'Excel avançado', 'Redes sociais (Facebook, Instagram, WhatsApp)', 'Edição de fotos/vídeos básica', 'Segurança digital', 'Outro'], affects_price: true, price_modifier: { 'Informática básica (ligar/usar o computador)': 0.8, 'Excel avançado': 1.3 }, is_required: true },
    { question: 'Perfil do aluno?', field_type: 'RADIO', options: ['Idoso (iniciante total)', 'Adulto iniciante', 'Adulto básico (usa um pouco)', 'Jovem/profissional'], affects_price: false, is_required: true },
    { question: 'Modalidade?', field_type: 'RADIO', options: ['Presencial (na minha casa)', 'Presencial (empresa do professor)', 'Online (videoconferência)'], affects_price: true, price_modifier: { 'Presencial (na minha casa)': 1.2, 'Presencial (empresa do professor)': 1, 'Online (videoconferência)': 0.8 }, is_required: true },
  ])

  console.log('✅ Categorias "Educação e Aulas" criadas')

  // ---------- FITNESS E BEM-ESTAR ----------

  const personalTrainer = await upsertCategory({
    group_id: fitness.id,
    name: 'Personal Trainer',
    slug: 'personal-trainer',
    icon: '🏋️',
    description: 'Treinos personalizados em casa ou ao ar livre',
    base_price_min: 80,
    base_price_max: 250,
    estimated_hours: 1,
  })
  await createQuestionnaire(personalTrainer.id, [
    { question: 'Local do treino?', field_type: 'RADIO', options: ['Na minha casa', 'Parque/ao ar livre', 'Na academia (professor acompanha)', 'Online'], affects_price: true, price_modifier: { 'Na minha casa': 1.2, 'Parque/ao ar livre': 1, 'Na academia (professor acompanha)': 1.1, 'Online': 0.7 }, is_required: true },
    { question: 'Objetivo principal?', field_type: 'SELECT', options: ['Emagrecimento', 'Ganho de massa muscular', 'Condicionamento físico', 'Reabilitação/fisio', 'Esporte específico', 'Saúde geral'], affects_price: false, is_required: true },
    { question: 'Nível de condicionamento atual?', field_type: 'RADIO', options: ['Sedentário (não pratico nada)', 'Iniciante (pratico há menos de 6 meses)', 'Intermediário', 'Avançado'], affects_price: false, is_required: true },
    { question: 'Frequência desejada?', field_type: 'RADIO', options: ['1x por semana', '2x por semana', '3x por semana', '4-5x por semana'], affects_price: true, price_modifier: { '1x por semana': 1, '2x por semana': 1.8, '3x por semana': 2.5, '4-5x por semana': 3.5 }, is_required: true },
    { question: 'Tem alguma restrição médica ou lesão?', field_type: 'TEXTAREA', is_required: false },
  ])

  const yogaPilates = await upsertCategory({
    group_id: fitness.id,
    name: 'Yoga e Pilates',
    slug: 'yoga-pilates',
    icon: '🧘',
    description: 'Aulas de yoga, pilates e meditação em casa ou online',
    base_price_min: 70,
    base_price_max: 200,
    estimated_hours: 1,
  })
  await createQuestionnaire(yogaPilates.id, [
    { question: 'Modalidade?', field_type: 'RADIO', options: ['Yoga (hatha, vinyasa, yin)', 'Pilates solo (no chão)', 'Pilates com aparelho', 'Meditação e mindfulness', 'Yoga + Meditação'], affects_price: true, price_modifier: { 'Yoga (hatha, vinyasa, yin)': 1, 'Pilates solo (no chão)': 1, 'Pilates com aparelho': 1.4, 'Meditação e mindfulness': 0.8 }, is_required: true },
    { question: 'Local da aula?', field_type: 'RADIO', options: ['Na minha casa', 'Parque/ao ar livre', 'Estúdio do professor', 'Online'], affects_price: true, price_modifier: { 'Na minha casa': 1.2, 'Parque/ao ar livre': 1, 'Estúdio do professor': 1, 'Online': 0.75 }, is_required: true },
    { question: 'Para quantas pessoas?', field_type: 'RADIO', options: ['1 pessoa', '2 pessoas', '3-5 pessoas'], affects_price: true, price_modifier: { '1 pessoa': 1, '2 pessoas': 1.5, '3-5 pessoas': 2 }, is_required: true },
    { question: 'Você tem alguma limitação física ou lesão?', field_type: 'TEXTAREA', is_required: false },
  ])

  const nutricionista = await upsertCategory({
    group_id: fitness.id,
    name: 'Nutricionista',
    slug: 'nutricionista',
    icon: '🥗',
    description: 'Consulta e acompanhamento nutricional presencial ou online',
    base_price_min: 100,
    base_price_max: 400,
    estimated_hours: 1,
  })
  await createQuestionnaire(nutricionista.id, [
    { question: 'Objetivo principal?', field_type: 'SELECT', options: ['Emagrecimento', 'Ganho de massa muscular', 'Saúde e bem-estar geral', 'Gestação/amamentação', 'Tratamento de doença (diabetes, hipertensão)', 'Alimentação esportiva (atletas)', 'Alimentação infantil', 'Vegano/vegetariano'], affects_price: false, is_required: true },
    { question: 'Tipo de consulta?', field_type: 'RADIO', options: ['Presencial (profissional vem até mim)', 'Presencial (clínica do profissional)', 'Online (videoconferência)'], affects_price: true, price_modifier: { 'Presencial (profissional vem até mim)': 1.3, 'Presencial (clínica do profissional)': 1, 'Online (videoconferência)': 0.85 }, is_required: true },
    { question: 'Precisa de acompanhamento mensal com retorno?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.5, 'false': 1 }, is_required: true },
    { question: 'Tem alguma condição de saúde ou alergia alimentar?', field_type: 'TEXTAREA', is_required: false },
  ])

  const crossfitFuncional = await upsertCategory({
    group_id: fitness.id,
    name: 'Treino Funcional / Crossfit',
    slug: 'treino-funcional',
    icon: '🏅',
    description: 'Aulas de treino funcional, HIIT e crossfit com personal',
    base_price_min: 70,
    base_price_max: 200,
    estimated_hours: 1,
  })
  await createQuestionnaire(crossfitFuncional.id, [
    { question: 'Tipo de treino?', field_type: 'RADIO', options: ['Funcional (com peso corporal)', 'HIIT (alta intensidade)', 'Crossfit', 'Circuito com equipamentos', 'Treinamento em grupo (até 5 pessoas)'], affects_price: true, price_modifier: { 'Funcional (com peso corporal)': 1, 'HIIT (alta intensidade)': 1, 'Crossfit': 1.2, 'Treinamento em grupo (até 5 pessoas)': 1.5 }, is_required: true },
    { question: 'Local do treino?', field_type: 'RADIO', options: ['Na minha casa', 'Parque/ao ar livre', 'Academia (acompanhamento)'], affects_price: true, price_modifier: { 'Na minha casa': 1.2, 'Parque/ao ar livre': 1, 'Academia (acompanhamento)': 1.1 }, is_required: true },
    { question: 'Nível de condicionamento?', field_type: 'RADIO', options: ['Iniciante', 'Intermediário', 'Avançado'], affects_price: false, is_required: true },
    { question: 'Frequência desejada?', field_type: 'RADIO', options: ['1x por semana', '2x por semana', '3x por semana', '4-5x por semana'], affects_price: true, price_modifier: { '1x por semana': 1, '2x por semana': 1.8, '3x por semana': 2.5, '4-5x por semana': 3.5 }, is_required: true },
  ])

  console.log('✅ Categorias "Fitness e Bem-Estar" criadas')

  // ---------- SAÚDE EM CASA ----------

  const fisioterapia = await upsertCategory({
    group_id: saude.id,
    name: 'Fisioterapia Domiciliar',
    slug: 'fisioterapia',
    icon: '🦴',
    description: 'Fisioterapia e reabilitação no conforto da sua casa',
    base_price_min: 120,
    base_price_max: 400,
    estimated_hours: 1,
  })
  await createQuestionnaire(fisioterapia.id, [
    { question: 'Tipo de fisioterapia?', field_type: 'SELECT', options: ['Ortopédica (pós-cirurgia, fratura, lesão)', 'Neurológica (AVC, Parkinson)', 'Respiratória/pulmonar', 'Geriátrica (idosos)', 'Pediátrica', 'Pélvica (incontinência, pós-parto)', 'Esportiva (atletas)', 'Dor crônica (coluna, joelho)'], affects_price: true, price_modifier: { 'Neurológica (AVC, Parkinson)': 1.3, 'Pélvica (incontinência, pós-parto)': 1.2, 'Esportiva (atletas)': 1.2 }, is_required: true },
    { question: 'Número de sessões desejadas?', field_type: 'SELECT', options: ['1 sessão (avaliação)', '5 sessões', '10 sessões', '20 sessões (tratamento completo)'], affects_price: true, price_modifier: { '1 sessão (avaliação)': 1, '5 sessões': 4.5, '10 sessões': 8, '20 sessões (tratamento completo)': 14 }, is_required: true },
    { question: 'O paciente tem laudo médico ou receita?', field_type: 'BOOLEAN', is_required: false, help_text: 'Recomendado mas não obrigatório' },
    { question: 'Descreva o problema ou condição de saúde', field_type: 'TEXTAREA', is_required: true },
  ])

  const cuidadorIdosos = await upsertCategory({
    group_id: saude.id,
    name: 'Cuidador de Idosos',
    slug: 'cuidador-idosos',
    icon: '👴',
    description: 'Cuidadores especializados para idosos em domicílio',
    base_price_min: 150,
    base_price_max: 600,
    estimated_hours: 8,
  })
  await createQuestionnaire(cuidadorIdosos.id, [
    { question: 'Período de atendimento?', field_type: 'RADIO', options: ['Diurno (12h)', 'Noturno (12h)', 'Plantão 24h', 'Mensalista (escala 12x36)', 'Horista (algumas horas)'], affects_price: true, price_modifier: { 'Diurno (12h)': 1, 'Noturno (12h)': 1.2, 'Plantão 24h': 2, 'Mensalista (escala 12x36)': 20, 'Horista (algumas horas)': 0.5 }, is_required: true },
    { question: 'Grau de dependência do idoso?', field_type: 'RADIO', options: ['Independente (só companhia)', 'Semi-dependente (ajuda em algumas atividades)', 'Dependente (precisa de ajuda total)', 'Acamado (cuidados intensivos)'], affects_price: true, price_modifier: { 'Independente (só companhia)': 0.8, 'Semi-dependente (ajuda em algumas atividades)': 1, 'Dependente (precisa de ajuda total)': 1.3, 'Acamado (cuidados intensivos)': 1.6 }, is_required: true },
    { question: 'O idoso tem condição específica?', field_type: 'SELECT', options: ['Alzheimer/demência', 'Parkinson', 'AVC (pós-derrame)', 'Diabetes', 'Hipertensão', 'Nenhuma condição específica', 'Outra'], affects_price: false, is_required: true },
    { question: 'É necessário ter experiência com sondas/fraldas/curativos?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
  ])

  const baba = await upsertCategory({
    group_id: saude.id,
    name: 'Babá / Cuidadora de Crianças',
    slug: 'baba',
    icon: '👶',
    description: 'Babás e cuidadoras de crianças para cuidados diários ou eventuais',
    base_price_min: 80,
    base_price_max: 300,
    estimated_hours: 4,
  })
  await createQuestionnaire(baba.id, [
    { question: 'Tipo de serviço?', field_type: 'RADIO', options: ['Babá por hora (evento/saída)', 'Babá diarista', 'Babá mensalista (cuidadora fixa)', 'Babá noturna', 'Acompanhante escolar'], affects_price: true, price_modifier: { 'Babá por hora (evento/saída)': 0.8, 'Babá diarista': 1, 'Babá mensalista (cuidadora fixa)': 15, 'Babá noturna': 1.3, 'Acompanhante escolar': 1 }, is_required: true },
    { question: 'Faixa etária da(s) criança(s)?', field_type: 'SELECT', options: ['Bebê (0-12 meses)', 'Toddler (1-3 anos)', 'Pré-escolar (3-6 anos)', 'Escolar (6-12 anos)', 'Misto (mais de uma faixa)'], affects_price: true, price_modifier: { 'Bebê (0-12 meses)': 1.3, 'Toddler (1-3 anos)': 1.2, 'Pré-escolar (3-6 anos)': 1, 'Escolar (6-12 anos)': 0.9, 'Misto (mais de uma faixa)': 1.2 }, is_required: true },
    { question: 'Quantas crianças?', field_type: 'SELECT', options: ['1 criança', '2 crianças', '3 crianças', '4 ou mais'], affects_price: true, price_modifier: { '1 criança': 1, '2 crianças': 1.3, '3 crianças': 1.5, '4 ou mais': 2 }, is_required: true },
    { question: 'Precisa que a babá auxilie com tarefas de casa?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.15, 'false': 1 }, is_required: true },
  ])

  const enfermagem = await upsertCategory({
    group_id: saude.id,
    name: 'Enfermagem Domiciliar',
    slug: 'enfermagem',
    icon: '💉',
    description: 'Aplicação de injeções, curativos e cuidados de enfermagem em casa',
    base_price_min: 80,
    base_price_max: 400,
    estimated_hours: 1,
  })
  await createQuestionnaire(enfermagem.id, [
    { question: 'Tipo de procedimento?', field_type: 'SELECT', options: ['Aplicação de injeção/vacina', 'Curativo simples', 'Curativo complexo', 'Sondagem vesical', 'Aferição de pressão/glicemia', 'Coleta de exame domiciliar', 'Hidratação venosa (soro)', 'Acompanhamento pós-cirúrgico'], affects_price: true, price_modifier: { 'Aplicação de injeção/vacina': 0.7, 'Curativo simples': 0.6, 'Curativo complexo': 1, 'Sondagem vesical': 1.5, 'Hidratação venosa (soro)': 1.3, 'Acompanhamento pós-cirúrgico': 1.2 }, is_required: true },
    { question: 'Tem receita/prescrição médica?', field_type: 'BOOLEAN', is_required: true, help_text: 'Obrigatório para procedimentos como injeções e hidratação venosa' },
    { question: 'Descreva o procedimento necessário', field_type: 'TEXTAREA', is_required: true },
  ])

  const psicologiaOnline = await upsertCategory({
    group_id: saude.id,
    name: 'Psicologia / Terapia',
    slug: 'psicologia',
    icon: '🧠',
    description: 'Consultas com psicólogo presenciais ou online',
    base_price_min: 100,
    base_price_max: 350,
    estimated_hours: 1,
  })
  await createQuestionnaire(psicologiaOnline.id, [
    { question: 'Público-alvo?', field_type: 'RADIO', options: ['Adulto individual', 'Casal', 'Criança/adolescente', 'Família', 'Idoso'], affects_price: true, price_modifier: { 'Adulto individual': 1, 'Casal': 1.3, 'Criança/adolescente': 1, 'Família': 1.5 }, is_required: true },
    { question: 'Modalidade?', field_type: 'RADIO', options: ['Online (videoconferência)', 'Presencial (consultório do psicólogo)', 'Presencial (em domicílio)'], affects_price: true, price_modifier: { 'Online (videoconferência)': 1, 'Presencial (consultório do psicólogo)': 1, 'Presencial (em domicílio)': 1.4 }, is_required: true },
    { question: 'Qual o principal motivo da consulta? (opcional)', field_type: 'SELECT', options: ['Ansiedade/estresse', 'Depressão', 'Luto', 'Relacionamentos', 'Autoconhecimento', 'Transtorno alimentar', 'TDAH/autismo', 'Vício/dependência', 'Prefiro não informar'], affects_price: false, is_required: false },
  ])

  console.log('✅ Categorias "Saúde em Casa" criadas')

  // ---------- FREELANCERS DIGITAIS ----------

  const designGrafico = await upsertCategory({
    group_id: digital.id,
    name: 'Design Gráfico / Logo',
    slug: 'design-grafico',
    icon: '🎨',
    description: 'Criação de logos, identidade visual, banners e materiais gráficos',
    base_price_min: 80,
    base_price_max: 2000,
    estimated_hours: 4,
  })
  await createQuestionnaire(designGrafico.id, [
    { question: 'Tipo de projeto?', field_type: 'SELECT', options: ['Logo/marca', 'Identidade visual completa', 'Banner (digital ou impresso)', 'Cartão de visitas', 'Cardápio', 'Post para redes sociais (pack)', 'Embalagem/rótulo', 'Apresentação/Pitch deck', 'Infográfico'], affects_price: true, price_modifier: { 'Logo/marca': 1, 'Identidade visual completa': 3, 'Banner (digital ou impresso)': 0.5, 'Embalagem/rótulo': 1.5, 'Apresentação/Pitch deck': 1.3 }, is_required: true },
    { question: 'Prazo de entrega?', field_type: 'RADIO', options: ['Urgente (24-48h)', 'Rápido (3-5 dias)', 'Normal (7-10 dias)', 'Sem pressa (mais de 10 dias)'], affects_price: true, price_modifier: { 'Urgente (24-48h)': 2, 'Rápido (3-5 dias)': 1.3, 'Normal (7-10 dias)': 1, 'Sem pressa (mais de 10 dias)': 0.9 }, is_required: true },
    { question: 'Quantas revisões você espera?', field_type: 'RADIO', options: ['1 revisão', '2-3 revisões', '4+ revisões (projeto complexo)'], affects_price: true, price_modifier: { '1 revisão': 1, '2-3 revisões': 1.2, '4+ revisões (projeto complexo)': 1.5 }, is_required: true },
    { question: 'Referências de estilo ou cores preferidas', field_type: 'PHOTO', is_required: false },
    { question: 'Descreva o projeto com detalhes', field_type: 'TEXTAREA', is_required: true, placeholder: 'Ex: preciso de um logo para minha barbearia chamada "Navalha de Ouro", cores escuras, estilo vintage' },
  ])

  const desenvolvimentoSite = await upsertCategory({
    group_id: digital.id,
    name: 'Desenvolvimento de Site / Landing Page',
    slug: 'desenvolvimento-site',
    icon: '🌐',
    description: 'Criação de sites, landing pages e lojas virtuais',
    base_price_min: 300,
    base_price_max: 5000,
    estimated_hours: 20,
  })
  await createQuestionnaire(desenvolvimentoSite.id, [
    { question: 'Tipo de projeto?', field_type: 'SELECT', options: ['Landing page (1 página)', 'Site institucional (5-10 páginas)', 'Blog', 'Loja virtual/E-commerce', 'Sistema/plataforma web', 'Aplicativo mobile (app)'], affects_price: true, price_modifier: { 'Landing page (1 página)': 0.4, 'Site institucional (5-10 páginas)': 1, 'Blog': 0.7, 'Loja virtual/E-commerce': 2, 'Sistema/plataforma web': 4, 'Aplicativo mobile (app)': 5 }, is_required: true },
    { question: 'Precisa de hospedagem e domínio?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.1, 'false': 1 }, is_required: true },
    { question: 'Prazo de entrega?', field_type: 'SELECT', options: ['Urgente (até 7 dias)', '2 semanas', '1 mês', 'Mais de 1 mês'], affects_price: true, price_modifier: { 'Urgente (até 7 dias)': 1.5, '2 semanas': 1.2, '1 mês': 1, 'Mais de 1 mês': 0.9 }, is_required: true },
    { question: 'URL de referência (site que você gosta)', field_type: 'TEXT', is_required: false, placeholder: 'Ex: https://exemplo.com.br' },
    { question: 'Descreva o projeto', field_type: 'TEXTAREA', is_required: true, placeholder: 'Ex: site para minha confeitaria, com cardápio online, galeria de fotos, formulário de pedido e link do WhatsApp' },
  ])

  const socialMedia = await upsertCategory({
    group_id: digital.id,
    name: 'Social Media / Gestão de Redes Sociais',
    slug: 'social-media',
    icon: '📱',
    description: 'Criação de conteúdo, gestão e crescimento de redes sociais',
    base_price_min: 200,
    base_price_max: 2000,
    estimated_hours: 20,
  })
  await createQuestionnaire(socialMedia.id, [
    { question: 'Redes sociais a gerenciar?', field_type: 'SELECT', options: ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube', 'Instagram + Facebook', 'Pacote completo (3+ redes)'], affects_price: true, price_modifier: { 'Instagram': 1, 'Facebook': 0.9, 'TikTok': 1.1, 'LinkedIn': 1, 'YouTube': 1.3, 'Instagram + Facebook': 1.6, 'Pacote completo (3+ redes)': 2.5 }, is_required: true },
    { question: 'Tipo de serviço?', field_type: 'SELECT', options: ['Criação de posts (artes)', 'Criação de posts + legenda', 'Gestão completa (posta, responde comentários)', 'Criação de stories/reels', 'Consultoria estratégica'], affects_price: true, price_modifier: { 'Criação de posts (artes)': 0.8, 'Criação de posts + legenda': 1, 'Gestão completa (posta, responde comentários)': 1.8, 'Consultoria estratégica': 1.2 }, is_required: true },
    { question: 'Quantidade de posts por mês?', field_type: 'SELECT', options: ['8 posts/mês (2 por semana)', '12 posts/mês (3 por semana)', '20 posts/mês (5 por semana)', '30 posts/mês (diário)'], affects_price: true, price_modifier: { '8 posts/mês (2 por semana)': 0.7, '12 posts/mês (3 por semana)': 1, '20 posts/mês (5 por semana)': 1.5, '30 posts/mês (diário)': 2 }, is_required: true },
    { question: 'Descreva seu negócio e o que você vende', field_type: 'TEXTAREA', is_required: true, placeholder: 'Ex: restaurante japonês em São Paulo, especialidade em sushi, público adulto classe média' },
  ])

  const edicaoVideo = await upsertCategory({
    group_id: digital.id,
    name: 'Edição de Vídeo',
    slug: 'edicao-video',
    icon: '🎬',
    description: 'Edição de vídeos para YouTube, reels, casamentos e marketing',
    base_price_min: 80,
    base_price_max: 1500,
    estimated_hours: 4,
  })
  await createQuestionnaire(edicaoVideo.id, [
    { question: 'Tipo de vídeo?', field_type: 'SELECT', options: ['Reels/Shorts (até 60s)', 'Vídeo YouTube (5-15 min)', 'Vídeo YouTube longo (acima de 15 min)', 'Vídeo de casamento/evento', 'Vídeo institucional/marketing', 'Vídeo de produto', 'Animação/Motion graphics'], affects_price: true, price_modifier: { 'Reels/Shorts (até 60s)': 0.4, 'Vídeo YouTube (5-15 min)': 1, 'Vídeo YouTube longo (acima de 15 min)': 1.5, 'Vídeo de casamento/evento': 2, 'Vídeo institucional/marketing': 1.8, 'Animação/Motion graphics': 2.5 }, is_required: true },
    { question: 'Quantos vídeos?', field_type: 'SELECT', options: ['1 vídeo', '2-4 vídeos', '5-10 vídeos', 'Pacote mensal'], affects_price: true, price_modifier: { '1 vídeo': 1, '2-4 vídeos': 3.2, '5-10 vídeos': 7, 'Pacote mensal': 10 }, is_required: true },
    { question: 'Prazo de entrega?', field_type: 'RADIO', options: ['Urgente (24-48h)', '3-5 dias', '7-10 dias', 'Mais de 10 dias'], affects_price: true, price_modifier: { 'Urgente (24-48h)': 1.6, '3-5 dias': 1.2, '7-10 dias': 1, 'Mais de 10 dias': 0.9 }, is_required: true },
    { question: 'Descreva o estilo e o que precisa no vídeo', field_type: 'TEXTAREA', is_required: true, placeholder: 'Ex: vídeo de produto de 30s para Instagram, estilo moderno com texto animado e música animada' },
  ])

  const redacaoConteudo = await upsertCategory({
    group_id: digital.id,
    name: 'Redação / Produção de Conteúdo',
    slug: 'redacao-conteudo',
    icon: '✍️',
    description: 'Textos para blog, SEO, e-commerce, e-mails e roteiros',
    base_price_min: 50,
    base_price_max: 800,
    estimated_hours: 3,
  })
  await createQuestionnaire(redacaoConteudo.id, [
    { question: 'Tipo de conteúdo?', field_type: 'SELECT', options: ['Artigo de blog (SEO)', 'Descrição de produto (e-commerce)', 'Post para redes sociais (legenda)', 'E-mail marketing/newsletter', 'Roteiro de vídeo', 'Texto para site/institucional', 'Tradução (português ↔ inglês)', 'Revisão e correção de texto'], affects_price: true, price_modifier: { 'Artigo de blog (SEO)': 1, 'Tradução (português ↔ inglês)': 1.3, 'Roteiro de vídeo': 1.2, 'Post para redes sociais (legenda)': 0.4 }, is_required: true },
    { question: 'Volume de conteúdo?', field_type: 'SELECT', options: ['1 texto/peça', '2-5 textos', '6-15 textos', 'Pacote mensal (20+ textos)'], affects_price: true, price_modifier: { '1 texto/peça': 1, '2-5 textos': 4, '6-15 textos': 9, 'Pacote mensal (20+ textos)': 15 }, is_required: true },
    { question: 'Prazo de entrega?', field_type: 'RADIO', options: ['Urgente (24h)', 'Rápido (3 dias)', 'Normal (7 dias)', 'Sem pressa'], affects_price: true, price_modifier: { 'Urgente (24h)': 1.5, 'Rápido (3 dias)': 1.2, 'Normal (7 dias)': 1, 'Sem pressa': 0.9 }, is_required: true },
    { question: 'Descreva o tema e o público-alvo', field_type: 'TEXTAREA', is_required: true, placeholder: 'Ex: artigo sobre "Como escolher colchão" para blog de loja de móveis, público adulto classe média' },
  ])

  console.log('✅ Categorias "Freelancers Digitais" criadas')

  // ---------- SERVIÇOS GERAIS ----------

  const lavanderia = await upsertCategory({
    group_id: gerais.id,
    name: 'Lavagem de Roupas / Lavanderia',
    slug: 'lavanderia',
    icon: '👕',
    description: 'Lavagem, secagem e passadoria de roupas em domicílio',
    base_price_min: 60,
    base_price_max: 300,
    estimated_hours: 2,
  })
  await createQuestionnaire(lavanderia.id, [
    { question: 'Tipo de serviço?', field_type: 'SELECT', options: ['Lavagem simples', 'Lavagem + secagem', 'Lavagem + secagem + passadoria', 'Somente passadoria', 'Lavagem de edredom/cobertor', 'Limpeza a seco'], affects_price: true, price_modifier: { 'Lavagem simples': 0.7, 'Lavagem + secagem': 1, 'Lavagem + secagem + passadoria': 1.5, 'Lavagem de edredom/cobertor': 1.3, 'Limpeza a seco': 2 }, is_required: true },
    { question: 'Quantidade aproximada de peças?', field_type: 'SELECT', options: ['Até 5 peças', '6-15 peças', '16-30 peças', 'Acima de 30 peças'], affects_price: true, price_modifier: { 'Até 5 peças': 0.5, '6-15 peças': 1, '16-30 peças': 1.8, 'Acima de 30 peças': 3 }, is_required: true },
    { question: 'O profissional vai buscar e devolver?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
  ])

  const chaveiro = await upsertCategory({
    group_id: gerais.id,
    name: 'Chaveiro',
    slug: 'chaveiro',
    icon: '🔐',
    description: 'Abertura de fechaduras, cópia de chaves e instalação de segredos',
    base_price_min: 80,
    base_price_max: 400,
    estimated_hours: 1,
  })
  await createQuestionnaire(chaveiro.id, [
    { question: 'Tipo de serviço?', field_type: 'SELECT', options: ['Abrir porta trancada (chave perdida)', 'Abrir porta trancada (chave dentro)', 'Cópia de chave simples', 'Cópia de chave eletrônica/magnética', 'Instalar/trocar fechadura', 'Troca de segredo/cilindro', 'Abrir cofre', 'Abertura de cadeado'], affects_price: true, price_modifier: { 'Abrir porta trancada (chave perdida)': 1.2, 'Cópia de chave simples': 0.4, 'Cópia de chave eletrônica/magnética': 1.5, 'Instalar/trocar fechadura': 1, 'Abrir cofre': 2 }, is_required: true },
    { question: 'É urgente? (atendimento imediato)', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.5, 'false': 1 }, is_required: true },
    { question: 'Tipo de porta/fechadura?', field_type: 'RADIO', options: ['Porta de madeira (residência)', 'Porta de metal', 'Porta de vidro/temperado', 'Portão de ferro', 'Carro', 'Não sei'], affects_price: false, is_required: true },
  ])

  const consertosEletrodomesticos = await upsertCategory({
    group_id: gerais.id,
    name: 'Conserto de Eletrodomésticos',
    slug: 'conserto-eletrodomesticos',
    icon: '🔌',
    description: 'Reparo de geladeira, máquina de lavar, fogão, microondas e mais',
    base_price_min: 80,
    base_price_max: 400,
    estimated_hours: 2,
  })
  await createQuestionnaire(consertosEletrodomesticos.id, [
    { question: 'Qual eletrodoméstico?', field_type: 'SELECT', options: ['Geladeira/Freezer', 'Máquina de lavar roupa', 'Máquina de secar', 'Lava-louças', 'Fogão/Cooktop', 'Forno elétrico/Microondas', 'Ar-condicionado (conserto)', 'Aspirador de pó', 'Liquidificador/Batedeira', 'Televisor'], affects_price: true, price_modifier: { 'Geladeira/Freezer': 1.2, 'Máquina de lavar roupa': 1.2, 'Televisor': 1 }, is_required: true },
    { question: 'Qual o problema?', field_type: 'TEXTAREA', is_required: true, placeholder: 'Ex: geladeira não está gelando, máquina de lavar não centrifuga, fogão não acende' },
    { question: 'O atendimento será em domicílio?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.2, 'false': 1 }, is_required: true },
  ])

  const motorista = await upsertCategory({
    group_id: gerais.id,
    name: 'Motorista Particular',
    slug: 'motorista-particular',
    icon: '🚘',
    description: 'Motorista por hora ou diária para compromissos e viagens',
    base_price_min: 60,
    base_price_max: 500,
    estimated_hours: 3,
  })
  await createQuestionnaire(motorista.id, [
    { question: 'Tipo de serviço?', field_type: 'RADIO', options: ['Transfer (aeroporto/rodoviária)', 'Motorista por hora', 'Diária completa (8h)', 'Médico/farmácia (acompanhamento)', 'Transferência para evento'], affects_price: true, price_modifier: { 'Transfer (aeroporto/rodoviária)': 1, 'Motorista por hora': 1, 'Diária completa (8h)': 5, 'Médico/farmácia (acompanhamento)': 1.2, 'Transferência para evento': 1.1 }, is_required: true },
    { question: 'O carro será do motorista ou seu?', field_type: 'RADIO', options: ['Carro do motorista', 'Meu carro (motorista só dirige)'], affects_price: true, price_modifier: { 'Carro do motorista': 1.2, 'Meu carro (motorista só dirige)': 0.8 }, is_required: true },
    { question: 'Quantas horas?', field_type: 'SELECT', options: ['1-2 horas', '3-4 horas', '5-8 horas', 'Diária (acima de 8h)'], affects_price: true, price_modifier: { '1-2 horas': 1, '3-4 horas': 1.8, '5-8 horas': 3, 'Diária (acima de 8h)': 4.5 }, is_required: true },
  ])

  const pinturaAzulejo = await upsertCategory({
    group_id: casa.id,
    name: 'Instalação de Piso / Azulejista',
    slug: 'instalacao-piso',
    icon: '🪟',
    description: 'Assentamento de porcelanato, cerâmica, vinílico e laminado',
    base_price_min: 200,
    base_price_max: 3000,
    estimated_hours: 8,
  })
  await createQuestionnaire(pinturaAzulejo.id, [
    { question: 'Tipo de serviço?', field_type: 'SELECT', options: ['Instalar porcelanato/cerâmica (piso)', 'Instalar azulejo (parede)', 'Instalar piso laminado/vinílico', 'Rejuntar/Retirar rejunte antigo', 'Trocar peças quebradas'], affects_price: true, price_modifier: { 'Instalar porcelanato/cerâmica (piso)': 1, 'Instalar azulejo (parede)': 1, 'Instalar piso laminado/vinílico': 0.8, 'Rejuntar/Retirar rejunte antigo': 0.5, 'Trocar peças quebradas': 0.6 }, is_required: true },
    { question: 'Área em m²?', field_type: 'SELECT', options: ['Até 10m²', '10-30m²', '30-60m²', '60-100m²', 'Acima de 100m²'], affects_price: true, price_modifier: { 'Até 10m²': 1, '10-30m²': 2.5, '30-60m²': 5, '60-100m²': 8, 'Acima de 100m²': 14 }, is_required: true },
    { question: 'O material (piso/azulejo) já está comprado?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.3 }, is_required: true },
    { question: 'Precisa retirar piso antigo?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1.3, 'false': 1 }, is_required: true },
    { question: 'Foto do local', field_type: 'PHOTO', is_required: true },
  ])

  const gesseiroDrywall = await upsertCategory({
    group_id: casa.id,
    name: 'Gesseiro / Drywall',
    slug: 'gesseiro-drywall',
    icon: '🏗️',
    description: 'Reboco, gesso, drywall, forro e divisórias',
    base_price_min: 150,
    base_price_max: 2000,
    estimated_hours: 6,
  })
  await createQuestionnaire(gesseiroDrywall.id, [
    { question: 'Tipo de serviço?', field_type: 'SELECT', options: ['Reboco/emboço (alisar parede)', 'Forro de gesso liso', 'Forro de gesso com moldura/sanca', 'Divisória de drywall', 'Parede de drywall', 'Gesso decorativo/3D', 'Correção de rachadura/trinca'], affects_price: true, price_modifier: { 'Reboco/emboço (alisar parede)': 1, 'Forro de gesso liso': 1.2, 'Forro de gesso com moldura/sanca': 1.8, 'Divisória de drywall': 1.5, 'Gesso decorativo/3D': 2 }, is_required: true },
    { question: 'Área em m²?', field_type: 'SELECT', options: ['Até 10m²', '10-30m²', '30-60m²', 'Acima de 60m²'], affects_price: true, price_modifier: { 'Até 10m²': 1, '10-30m²': 2.5, '30-60m²': 5, 'Acima de 60m²': 8 }, is_required: true },
    { question: 'Foto do local', field_type: 'PHOTO', is_required: true },
  ])

  const serralheiroPortoes = await upsertCategory({
    group_id: casa.id,
    name: 'Serralheria / Portões e Grades',
    slug: 'serralheria',
    icon: '🚪',
    description: 'Instalação e reparo de portões, grades, escadas e estruturas metálicas',
    base_price_min: 150,
    base_price_max: 3000,
    estimated_hours: 4,
  })
  await createQuestionnaire(serralheiroPortoes.id, [
    { question: 'Tipo de serviço?', field_type: 'SELECT', options: ['Instalar portão de correr', 'Instalar portão basculante', 'Instalar grade de ferro', 'Instalar porta de ferro', 'Conserto de portão/grade', 'Automatizar portão (motor)', 'Instalar cobertura metálica'], affects_price: true, price_modifier: { 'Instalar portão de correr': 1, 'Automatizar portão (motor)': 1.5, 'Instalar cobertura metálica': 2 }, is_required: true },
    { question: 'Material?', field_type: 'RADIO', options: ['Ferro tradicional', 'Alumínio', 'Aço inox', 'Não sei/deixo a cargo do profissional'], affects_price: true, price_modifier: { 'Ferro tradicional': 1, 'Alumínio': 1.3, 'Aço inox': 1.6 }, is_required: true },
    { question: 'O material já está comprado?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.4 }, is_required: true },
    { question: 'Foto do local / do portão atual', field_type: 'PHOTO', is_required: false },
  ])

  const impermeabilizacao = await upsertCategory({
    group_id: casa.id,
    name: 'Impermeabilização',
    slug: 'impermeabilizacao',
    icon: '💧',
    description: 'Impermeabilização de laje, banheiro, piscina e fundações',
    base_price_min: 200,
    base_price_max: 2000,
    estimated_hours: 4,
  })
  await createQuestionnaire(impermeabilizacao.id, [
    { question: 'Onde será feita a impermeabilização?', field_type: 'SELECT', options: ['Laje/terraço', 'Banheiro (box, piso)', 'Piscina', 'Caixa d\'água', 'Parede com umidade', 'Fundação/subsolo', 'Calhas e telhado'], affects_price: true, price_modifier: { 'Laje/terraço': 1, 'Piscina': 1.8, 'Caixa d\'água': 1, 'Fundação/subsolo': 1.5 }, is_required: true },
    { question: 'Área em m²?', field_type: 'SELECT', options: ['Até 20m²', '20-50m²', '50-100m²', 'Acima de 100m²'], affects_price: true, price_modifier: { 'Até 20m²': 1, '20-50m²': 2, '50-100m²': 3.5, 'Acima de 100m²': 6 }, is_required: true },
    { question: 'Há infiltração ativa (está molhando)?', field_type: 'BOOLEAN', is_required: true, help_text: 'Infiltrações ativas podem precisar de reparo estrutural adicional' },
    { question: 'Foto do local com o problema', field_type: 'PHOTO', is_required: true },
  ])

  const instalacaoCortinas = await upsertCategory({
    group_id: casa.id,
    name: 'Instalação de Cortinas / Persianas',
    slug: 'instalacao-cortinas',
    icon: '🪟',
    description: 'Instalação de cortinas, persianas e papel de parede',
    base_price_min: 80,
    base_price_max: 500,
    estimated_hours: 2,
  })
  await createQuestionnaire(instalacaoCortinas.id, [
    { question: 'Tipo de produto?', field_type: 'SELECT', options: ['Cortina com varão', 'Persiana horizontal', 'Persiana vertical', 'Painel romano', 'Blackout', 'Papel de parede', 'Trilho embutido (sanca)'], affects_price: true, price_modifier: { 'Cortina com varão': 1, 'Persiana horizontal': 1, 'Blackout': 1, 'Papel de parede': 1.5, 'Trilho embutido (sanca)': 1.8 }, is_required: true },
    { question: 'Quantas janelas/ambientes?', field_type: 'SELECT', options: ['1 janela', '2-3 janelas', '4-6 janelas', 'Casa inteira'], affects_price: true, price_modifier: { '1 janela': 1, '2-3 janelas': 2.5, '4-6 janelas': 4, 'Casa inteira': 7 }, is_required: true },
    { question: 'O produto já está comprado?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.4 }, is_required: true },
    { question: 'Foto do local/janela', field_type: 'PHOTO', is_required: false },
  ])

  const limpezaSofas = await upsertCategory({
    group_id: casa.id,
    name: 'Limpeza de Sofá / Estofados',
    slug: 'limpeza-sofas',
    icon: '🛋️',
    description: 'Higienização e lavagem de sofás, colchões e tapetes',
    base_price_min: 80,
    base_price_max: 600,
    estimated_hours: 2,
  })
  await createQuestionnaire(limpezaSofas.id, [
    { question: 'O que será higienizado?', field_type: 'SELECT', options: ['Sofá', 'Colchão', 'Tapete/carpete', 'Poltrona', 'Sofá + colchão', 'Cadeiras estofadas'], affects_price: true, price_modifier: { 'Sofá': 1, 'Colchão': 0.9, 'Tapete/carpete': 0.8, 'Poltrona': 0.7, 'Sofá + colchão': 1.8 }, is_required: true },
    { question: 'Tamanho do sofá (se for sofá)?', field_type: 'SELECT', options: ['2 lugares', '3 lugares', '4 lugares (L)', '5+ lugares (chaise/canto)', 'Não se aplica'], affects_price: true, price_modifier: { '2 lugares': 0.7, '3 lugares': 1, '4 lugares (L)': 1.3, '5+ lugares (chaise/canto)': 1.8 }, is_required: false },
    { question: 'Há manchas específicas?', field_type: 'BOOLEAN', is_required: true, help_text: 'Manchas de tinta, sangue ou óleo podem precisar de tratamento especial' },
    { question: 'Material do estofado?', field_type: 'SELECT', options: ['Tecido comum', 'Veludo', 'Couro natural', 'Couro sintético/PU', 'Suede', 'Não sei'], affects_price: true, price_modifier: { 'Tecido comum': 1, 'Veludo': 1.2, 'Couro natural': 1.3, 'Suede': 1.4 }, is_required: true },
    { question: 'Foto do estofado', field_type: 'PHOTO', is_required: false },
  ])

  const jardimPaisagismo = await upsertCategory({
    group_id: casa.id,
    name: 'Jardinagem e Paisagismo',
    slug: 'jardinagem-paisagismo',
    icon: '🌸',
    description: 'Projeto e manutenção de jardins, hortas e áreas verdes',
    base_price_min: 100,
    base_price_max: 2000,
    estimated_hours: 3,
  })
  await createQuestionnaire(jardimPaisagismo.id, [
    { question: 'Tipo de serviço?', field_type: 'SELECT', options: ['Manutenção de jardim existente', 'Criar jardim do zero', 'Projeto paisagístico', 'Horta orgânica', 'Poda de árvores/arbustos', 'Plantio de mudas', 'Adubação e fertilização'], affects_price: true, price_modifier: { 'Manutenção de jardim existente': 1, 'Criar jardim do zero': 2, 'Projeto paisagístico': 3, 'Poda de árvores/arbustos': 1.2 }, is_required: true },
    { question: 'Tamanho da área verde?', field_type: 'SELECT', options: ['Pequena (até 20m²)', 'Média (20-60m²)', 'Grande (60-150m²)', 'Muito grande (acima de 150m²)'], affects_price: true, price_modifier: { 'Pequena (até 20m²)': 1, 'Média (20-60m²)': 1.8, 'Grande (60-150m²)': 3, 'Muito grande (acima de 150m²)': 5 }, is_required: true },
    { question: 'As plantas/materiais já estão comprados?', field_type: 'BOOLEAN', affects_price: true, price_modifier: { 'true': 1, 'false': 1.4 }, is_required: true },
    { question: 'Foto atual do jardim/espaço', field_type: 'PHOTO', is_required: false },
  ])

  console.log('✅ Categorias "Serviços Gerais" e adicionais criadas')

  // ============================================================
  // USUÁRIO ADMIN E DE TESTE
  // ============================================================
  const adminPassword = await bcrypt.hash('Admin@123', 10)
  await prisma.user.upsert({
    where: { email: 'admin@missaocumprida.com.br' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@missaocumprida.com.br',
      password: adminPassword,
      role: 'ADMIN',
      document_verified: true,
    },
  })

  const clientePassword = await bcrypt.hash('Teste@123', 10)
  await prisma.user.upsert({
    where: { email: 'cliente@teste.com' },
    update: {},
    create: {
      name: 'Cliente Teste',
      email: 'cliente@teste.com',
      password: clientePassword,
      phone: '11999990001',
      role: 'CLIENT',
    },
  })

  const prestadorPassword = await bcrypt.hash('Teste@123', 10)
  const prestador = await prisma.user.upsert({
    where: { email: 'prestador@teste.com' },
    update: {},
    create: {
      name: 'Prestador Teste',
      email: 'prestador@teste.com',
      password: prestadorPassword,
      phone: '11999990002',
      role: 'PROVIDER',
      bio: 'Profissional experiente em jardinagem e limpeza.',
      document_verified: true,
    },
  })

  await prisma.providerSkill.upsert({
    where: { provider_id_category_id: { provider_id: prestador.id, category_id: cortarGrama.id } },
    update: {},
    create: {
      provider_id: prestador.id,
      category_id: cortarGrama.id,
      years_experience: 5,
      service_radius_km: 30,
      hourly_rate: 60,
    },
  })

  console.log('✅ Usuários de teste criados')
  console.log('')
  console.log('🎉 Seed concluído com sucesso!')
  console.log('')
  console.log('Usuários criados:')
  console.log('  Admin:     admin@missaocumprida.com.br / Admin@123')
  console.log('  Cliente:   cliente@teste.com / Teste@123')
  console.log('  Prestador: prestador@teste.com / Teste@123')
}

// Funções auxiliares
async function upsertCategory(data: {
  group_id: string
  name: string
  slug: string
  icon: string
  description?: string
  base_price_min: number
  base_price_max: number
  requires_photos?: boolean
  estimated_hours?: number
}) {
  return prisma.category.upsert({
    where: { slug: data.slug },
    update: {},
    create: {
      ...data,
      requires_photos: data.requires_photos ?? true,
    },
  })
}

async function createQuestionnaire(
  category_id: string,
  fields: Array<{
    question: string
    field_type: string
    options?: string[]
    is_required?: boolean
    affects_price?: boolean
    price_modifier?: Record<string, number>
    help_text?: string
    placeholder?: string
  }>
) {
  // Remove campos antigos e recria (para idempotência no seed)
  await prisma.questionnaireField.deleteMany({ where: { category_id } })

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    await prisma.questionnaireField.create({
      data: {
        category_id,
        question: f.question,
        field_type: f.field_type as FieldType,
        options: f.options ? f.options : undefined,
        is_required: f.is_required ?? true,
        order: i + 1,
        affects_price: f.affects_price ?? false,
        price_modifier: f.price_modifier ? f.price_modifier : undefined,
        help_text: f.help_text,
        placeholder: f.placeholder,
      },
    })
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
