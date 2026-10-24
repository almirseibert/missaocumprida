import { PrismaClient } from '@prisma/client'
import { syncQuestionnaire, SeedField } from './catalogSync'

/**
 * Catálogo v3 (revisão pós-Play, 24/10/2026) — categorias que faltavam,
 * conferidas contra o catálogo atual para NÃO repetir serviço já existente
 * (ex.: montagem de móveis já é "Marcenaria / Montagem de Móveis",
 * desentupimento já está em Encanador, pneu/alinhamento em Mecânica Leve,
 * pós-obra em Limpeza Residencial).
 * Fotos não entram como pergunta: todas as categorias têm o bloco de fotos
 * opcional. A pergunta "Descreva…" vira a dica do campo Descrição.
 * Idempotente (upsert por slug + sincronização por chave estável).
 */

type NewCategory = {
  group: string
  name: string
  slug: string
  icon: string
  description: string
  min: number
  max: number
  hours?: number
  questions: SeedField[]
}

const R = (question: string, options: string[], mods?: Record<string, number>, required = true): SeedField => ({
  question,
  field_type: 'RADIO',
  options,
  is_required: required,
  affects_price: !!mods,
  price_modifier: mods,
})
const S = (question: string, options: string[], mods?: Record<string, number>, required = true): SeedField => ({
  ...R(question, options, mods, required),
  field_type: 'SELECT',
})
const B = (question: string, mods?: Record<string, number>): SeedField => ({
  question,
  field_type: 'BOOLEAN',
  is_required: false,
  affects_price: !!mods,
  price_modifier: mods,
})
const N = (question: string, placeholder?: string): SeedField => ({ question, field_type: 'NUMBER', is_required: false, placeholder })
const D = (hint: string, required = false): SeedField => ({ question: 'Descreva o que você precisa', field_type: 'TEXTAREA', is_required: required, placeholder: hint })

export const CATALOGO_V3: NewCategory[] = [
  // ════════════ 🏠 PARA SUA CASA ════════════
  {
    group: 'para-sua-casa', name: 'Marido de Aluguel / Pequenos Reparos', slug: 'marido-de-aluguel', icon: '🧰',
    description: 'Vários reparos pequenos numa só visita: furar parede, pendurar quadros, trocar resistência, ajustar portas.', min: 80, max: 400, hours: 3,
    questions: [
      S('Quantos serviços pequenos?', ['1 a 3', '4 a 6', '7 ou mais'], { '1 a 3': 1, '4 a 6': 1.6, '7 ou mais': 2.3 }),
      B('Você já tem os materiais?', { true: 1, false: 1.15 }),
      D('Ex: instalar 3 prateleiras, pendurar 2 quadros, regular a porta do quarto e trocar o sifão da pia', true),
    ],
  },
  {
    group: 'para-sua-casa', name: 'Remoção e Corte de Árvores', slug: 'poda-remocao-arvores', icon: '🌳',
    description: 'Corte, remoção e poda de árvores de grande porte, com retirada dos galhos.', min: 200, max: 2500, hours: 5,
    questions: [
      R('O que precisa ser feito?', ['Poda de árvore grande', 'Corte/remoção da árvore', 'Remoção de toco/raiz'], { 'Poda de árvore grande': 1, 'Corte/remoção da árvore': 1.8, 'Remoção de toco/raiz': 1.3 }),
      R('Altura aproximada da árvore?', ['Até 5 m', '5 a 10 m', 'Mais de 10 m'], { 'Até 5 m': 1, '5 a 10 m': 1.7, 'Mais de 10 m': 2.6 }),
      B('Precisa retirar os galhos e o tronco do local?', { true: 1.3, false: 1 }),
      B('A árvore está perto de fios ou da casa?', { true: 1.4, false: 1 }),
    ],
  },
  {
    group: 'para-sua-casa', name: 'Interfone e Porteiro Eletrônico', slug: 'interfone-porteiro', icon: '🔔',
    description: 'Instalação e conserto de interfone, vídeo-porteiro e fechadura elétrica.', min: 100, max: 900, hours: 2,
    questions: [
      R('Serviço?', ['Instalação nova', 'Conserto', 'Troca por vídeo-porteiro'], { 'Instalação nova': 1.3, Conserto: 1, 'Troca por vídeo-porteiro': 1.5 }),
      R('Tipo de imóvel?', ['Casa', 'Apartamento', 'Condomínio/prédio'], { Casa: 1, Apartamento: 1, 'Condomínio/prédio': 2 }),
      B('Tem fechadura elétrica no portão?', { true: 1.1, false: 1 }),
    ],
  },
  {
    group: 'para-sua-casa', name: 'Alarme e Cerca Elétrica', slug: 'alarme-cerca-eletrica', icon: '🚨',
    description: 'Instalação e manutenção de alarme residencial, sensores e cerca elétrica.', min: 150, max: 2500, hours: 4,
    questions: [
      R('O que você precisa?', ['Alarme com sensores', 'Cerca elétrica', 'Alarme + cerca', 'Manutenção/conserto'], { 'Alarme com sensores': 1, 'Cerca elétrica': 1.2, 'Alarme + cerca': 1.9, 'Manutenção/conserto': 0.6 }),
      N('Metros de muro (se cerca elétrica)', 'Ex: 40'),
      B('Quer monitoramento pelo celular?', { true: 1.2, false: 1 }),
    ],
  },
  {
    group: 'para-sua-casa', name: 'Instalação de Gás', slug: 'instalacao-gas', icon: '🔥',
    description: 'Instalação e troca de pontos de gás, mangueiras, registros e conversão de fogão (GLP/encanado).', min: 100, max: 1200, hours: 3,
    questions: [
      R('Serviço?', ['Novo ponto de gás', 'Troca de mangueira/registro', 'Conversão GLP ↔ gás encanado', 'Teste de vazamento'], { 'Novo ponto de gás': 1.6, 'Troca de mangueira/registro': 0.7, 'Conversão GLP ↔ gás encanado': 1, 'Teste de vazamento': 0.6 }),
      R('Para qual aparelho?', ['Fogão/cooktop', 'Aquecedor', 'Churrasqueira/forno', 'Mais de um'], { 'Fogão/cooktop': 1, Aquecedor: 1.3, 'Churrasqueira/forno': 1.2, 'Mais de um': 1.6 }),
      B('Está sentindo cheiro de gás agora?'),
    ],
  },

  // ════════════ 🧱 REFORMAS E CONSTRUÇÃO ════════════
  {
    group: 'reformas-construcao', name: 'Marmoraria (Pedras e Bancadas)', slug: 'marmoraria', icon: '🪨',
    description: 'Bancadas, pias, soleiras e escadas em mármore, granito e quartzo.', min: 300, max: 6000, hours: 6,
    questions: [
      S('O que precisa?', ['Bancada de cozinha', 'Bancada de banheiro', 'Soleiras e peitoris', 'Escada', 'Reparo/polimento'], { 'Bancada de cozinha': 1.5, 'Bancada de banheiro': 1, 'Soleiras e peitoris': 0.6, Escada: 2, 'Reparo/polimento': 0.5 }),
      R('Material?', ['Granito', 'Mármore', 'Quartzo', 'Ainda não sei'], { Granito: 1, Mármore: 1.4, Quartzo: 1.6, 'Ainda não sei': 1.2 }),
      N('Metragem aproximada (m lineares)', 'Ex: 3'),
    ],
  },
  {
    group: 'reformas-construcao', name: 'Raspagem e Sinteco de Piso', slug: 'sinteco-raspagem-piso', icon: '🪵',
    description: 'Raspagem, lixamento e aplicação de sinteco/verniz em tacos e assoalhos.', min: 300, max: 4000, hours: 8,
    questions: [
      N('Área do piso (m²)', 'Ex: 30'),
      R('Serviço?', ['Raspagem + sinteco', 'Só aplicação de verniz', 'Reparo de tacos soltos'], { 'Raspagem + sinteco': 1.4, 'Só aplicação de verniz': 0.8, 'Reparo de tacos soltos': 0.6 }),
      R('Acabamento?', ['Brilhante', 'Acetinado', 'Fosco'], { Brilhante: 1, Acetinado: 1.05, Fosco: 1.1 }),
    ],
  },
  {
    group: 'reformas-construcao', name: 'Limpa-Fossa e Caixa de Gordura', slug: 'limpa-fossa', icon: '🚛',
    description: 'Esgotamento de fossa séptica, sumidouro e limpeza de caixa de gordura com caminhão.', min: 250, max: 1500, hours: 2,
    questions: [
      R('O que precisa limpar?', ['Fossa séptica', 'Caixa de gordura', 'Fossa + caixa de gordura', 'Sumidouro'], { 'Fossa séptica': 1, 'Caixa de gordura': 0.5, 'Fossa + caixa de gordura': 1.3, Sumidouro: 1.2 }),
      R('Tamanho aproximado?', ['Até 3.000 L', '3.000 a 6.000 L', 'Mais de 6.000 L', 'Não sei'], { 'Até 3.000 L': 1, '3.000 a 6.000 L': 1.6, 'Mais de 6.000 L': 2.3, 'Não sei': 1.3 }),
      B('O caminhão consegue chegar perto (até 30 m)?', { true: 1, false: 1.3 }),
    ],
  },
  {
    group: 'reformas-construcao', name: 'Pavimentação e Pavers', slug: 'pavimentacao-pavers', icon: '🧱',
    description: 'Calçadas, garagens e pátios com pavers, blocos intertravados ou concreto.', min: 400, max: 15000, hours: 16,
    questions: [
      N('Área (m²)', 'Ex: 40'),
      R('Tipo?', ['Paver/intertravado', 'Concreto', 'Pedra', 'Ainda não sei'], { 'Paver/intertravado': 1, Concreto: 0.9, Pedra: 1.4, 'Ainda não sei': 1.1 }),
      B('Precisa remover o piso antigo?', { true: 1.3, false: 1 }),
    ],
  },
  {
    group: 'reformas-construcao', name: 'Toldos e Coberturas', slug: 'toldos-coberturas', icon: '⛱️',
    description: 'Toldos, pergolados e coberturas em policarbonato, vidro ou lona.', min: 400, max: 12000, hours: 10,
    questions: [
      S('Tipo?', ['Toldo retrátil', 'Cobertura de policarbonato', 'Cobertura de vidro', 'Pergolado', 'Conserto/troca de lona'], { 'Toldo retrátil': 1, 'Cobertura de policarbonato': 1.3, 'Cobertura de vidro': 2, Pergolado: 1.6, 'Conserto/troca de lona': 0.5 }),
      N('Área aproximada (m²)', 'Ex: 12'),
    ],
  },

  // ════════════ 🧺 LIMPEZA E DOMÉSTICO ════════════
  {
    group: 'limpeza-domestico', name: 'Limpeza Comercial e de Condomínio', slug: 'limpeza-comercial-condominio', icon: '🏢',
    description: 'Limpeza de escritórios, lojas, consultórios e áreas comuns de condomínio.', min: 150, max: 3000, hours: 6,
    questions: [
      R('Local?', ['Escritório', 'Loja', 'Consultório/clínica', 'Áreas comuns de condomínio'], { Escritório: 1, Loja: 1, 'Consultório/clínica': 1.2, 'Áreas comuns de condomínio': 1.4 }),
      N('Área aproximada (m²)', 'Ex: 120'),
      R('Frequência?', ['Uma vez', 'Semanal', 'Diária (seg a sex)'], { 'Uma vez': 1, Semanal: 0.9, 'Diária (seg a sex)': 0.8 }),
    ],
  },
  {
    group: 'limpeza-domestico', name: 'Personal Organizer', slug: 'personal-organizer', icon: '🗂️',
    description: 'Organização de closets, cozinha, casa toda e preparação de mudança.', min: 150, max: 1500, hours: 5,
    questions: [
      S('O que organizar?', ['Closet/guarda-roupa', 'Cozinha e despensa', 'Casa toda', 'Escritório em casa', 'Mudança (embalar/desembalar)'], { 'Closet/guarda-roupa': 1, 'Cozinha e despensa': 1, 'Casa toda': 2.5, 'Escritório em casa': 1, 'Mudança (embalar/desembalar)': 2 }),
      B('Quer que traga caixas e organizadores?', { true: 1.2, false: 1 }),
    ],
  },

  // ════════════ 🔌 ASSISTÊNCIA TÉCNICA ════════════
  {
    group: 'assistencia-tecnica', name: 'Conserto de Bicicleta', slug: 'conserto-bicicleta', icon: '🚲',
    description: 'Revisão, regulagem de marchas e freios, troca de pneu/câmara e peças.', min: 40, max: 400, hours: 1,
    questions: [
      S('Serviço?', ['Revisão completa', 'Regulagem de marchas/freios', 'Troca de pneu/câmara', 'Troca de peças', 'Bicicleta elétrica'], { 'Revisão completa': 1.5, 'Regulagem de marchas/freios': 0.8, 'Troca de pneu/câmara': 0.6, 'Troca de peças': 1, 'Bicicleta elétrica': 1.8 }),
      B('Precisa buscar a bicicleta em casa?', { true: 1.2, false: 1 }),
    ],
  },
  {
    group: 'assistencia-tecnica', name: 'Conserto de Máquina de Costura', slug: 'conserto-maquina-costura', icon: '🪡',
    description: 'Revisão, regulagem e conserto de máquinas de costura domésticas e industriais.', min: 60, max: 500, hours: 2,
    questions: [
      R('Tipo de máquina?', ['Doméstica', 'Industrial', 'Overloque/galoneira'], { Doméstica: 1, Industrial: 1.6, 'Overloque/galoneira': 1.4 }),
      R('Serviço?', ['Revisão/limpeza', 'Conserto (não costura, pula ponto)', 'Troca de peça'], { 'Revisão/limpeza': 0.8, 'Conserto (não costura, pula ponto)': 1, 'Troca de peça': 1.2 }),
    ],
  },

  // ════════════ 🚗 PARA SEU CARRO ════════════
  {
    group: 'para-seu-carro', name: 'Vistoria Pré-Compra de Veículo', slug: 'vistoria-pre-compra', icon: '🔎',
    description: 'Avaliação mecânica e estrutural de um carro usado antes de comprar.', min: 150, max: 600, hours: 2,
    questions: [
      R('Tipo de veículo?', ['Carro', 'Moto', 'Caminhonete/SUV'], { Carro: 1, Moto: 0.7, 'Caminhonete/SUV': 1.2 }),
      B('Inclui scanner/diagnóstico eletrônico?', { true: 1.3, false: 1 }),
      B('Inclui checagem de documentação e histórico?', { true: 1.2, false: 1 }),
    ],
  },

  // ════════════ 💇 BELEZA E ESTÉTICA ════════════
  {
    group: 'beleza-estetica', name: 'Design de Sobrancelhas', slug: 'design-sobrancelhas', icon: '🪮',
    description: 'Design com pinça ou linha, henna e brow lamination. Micropigmentação tem categoria própria.', min: 30, max: 180, hours: 1,
    questions: [
      R('Serviço?', ['Design simples', 'Design + henna', 'Brow lamination', 'Design masculino'], { 'Design simples': 1, 'Design + henna': 1.5, 'Brow lamination': 2.4, 'Design masculino': 0.9 }),
      R('Técnica preferida?', ['Pinça', 'Linha', 'Cera', 'Tanto faz'], undefined, false),
    ],
  },
  {
    group: 'beleza-estetica', name: 'Tatuagem e Piercing', slug: 'tatuagem-piercing', icon: '🖋️',
    description: 'Tatuagem, cobertura (cover-up), retoque e aplicação de piercing.', min: 100, max: 3000, hours: 3,
    questions: [
      R('O que você quer?', ['Tatuagem nova', 'Cobertura (cover-up)', 'Retoque', 'Piercing'], { 'Tatuagem nova': 1, 'Cobertura (cover-up)': 1.5, Retoque: 0.5, Piercing: 0.3 }),
      R('Tamanho aproximado?', ['Pequena (até 5 cm)', 'Média (5 a 15 cm)', 'Grande (mais de 15 cm)', 'Fechamento (braço, costas)'], { 'Pequena (até 5 cm)': 0.5, 'Média (5 a 15 cm)': 1, 'Grande (mais de 15 cm)': 2, 'Fechamento (braço, costas)': 4 }, false),
      R('Estilo?', ['Fine line', 'Realismo', 'Old school', 'Escrita', 'Outro'], undefined, false),
    ],
  },
  {
    group: 'beleza-estetica', name: 'Mega Hair e Alongamento Capilar', slug: 'mega-hair', icon: '💁',
    description: 'Aplicação, manutenção e remoção de mega hair.', min: 200, max: 3000, hours: 4,
    questions: [
      R('Serviço?', ['Aplicação', 'Manutenção', 'Remoção'], { Aplicação: 1, Manutenção: 0.5, Remoção: 0.3 }),
      R('Técnica?', ['Fita adesiva', 'Queratina', 'Microlink/anel', 'Costurado (tela)', 'Não sei'], { 'Fita adesiva': 1, Queratina: 1.2, 'Microlink/anel': 1.1, 'Costurado (tela)': 0.9, 'Não sei': 1 }),
      B('Você já tem o cabelo (as mechas)?', { true: 1, false: 2.5 }),
    ],
  },

  // ════════════ 🎉 EVENTOS E FESTAS ════════════
  {
    group: 'eventos-festas', name: 'Banda e Músico ao Vivo', slug: 'banda-musico', icon: '🎸',
    description: 'Voz e violão, bandas e músicos para festas, casamentos e eventos corporativos.', min: 300, max: 6000, hours: 4,
    questions: [
      R('Formação?', ['Voz e violão', 'Duo/trio', 'Banda completa', 'Instrumental (cerimônia)'], { 'Voz e violão': 1, 'Duo/trio': 1.8, 'Banda completa': 3.5, 'Instrumental (cerimônia)': 1.5 }),
      R('Duração?', ['Até 2 h', '2 a 4 h', 'Mais de 4 h'], { 'Até 2 h': 1, '2 a 4 h': 1.6, 'Mais de 4 h': 2.2 }),
      B('Precisa levar som e iluminação?', { true: 1.4, false: 1 }),
    ],
  },
  {
    group: 'eventos-festas', name: 'Florista e Arranjos', slug: 'florista', icon: '💐',
    description: 'Arranjos, buquês, decoração floral de cerimônias e coroas.', min: 80, max: 5000, hours: 3,
    questions: [
      S('O que precisa?', ['Buquê', 'Arranjos de mesa', 'Decoração floral de cerimônia', 'Coroa de flores', 'Flores para evento corporativo'], { Buquê: 0.5, 'Arranjos de mesa': 1, 'Decoração floral de cerimônia': 3, 'Coroa de flores': 1, 'Flores para evento corporativo': 1.5 }),
      N('Quantidade de arranjos', 'Ex: 10'),
      B('Inclui entrega e montagem no local?', { true: 1.2, false: 1 }),
    ],
  },
  {
    group: 'eventos-festas', name: 'Aluguel de Mesas, Cadeiras e Tendas', slug: 'aluguel-mesas-cadeiras-tendas', icon: '⛺',
    description: 'Mesas, cadeiras, toalhas, tendas e louças para festas, com entrega e retirada.', min: 100, max: 4000, hours: 2,
    questions: [
      N('Número de convidados', 'Ex: 80'),
      S('O que precisa?', ['Mesas e cadeiras', 'Tenda', 'Mesas, cadeiras e tenda', 'Louças e talheres', 'Pacote completo'], { 'Mesas e cadeiras': 1, Tenda: 1.5, 'Mesas, cadeiras e tenda': 2.2, 'Louças e talheres': 0.8, 'Pacote completo': 3 }),
      B('Precisa de montagem no local?', { true: 1.2, false: 1 }),
    ],
  },
  {
    group: 'eventos-festas', name: 'Salgados para Festa', slug: 'salgados-festa', icon: '🥟',
    description: 'Salgados fritos e assados por cento, para festas e eventos.', min: 60, max: 1500, hours: 4,
    questions: [
      N('Quantos centos?', 'Ex: 5'),
      R('Tipo?', ['Fritos', 'Assados', 'Fritos e assados', 'Mini lanches'], { Fritos: 1, Assados: 1.1, 'Fritos e assados': 1.05, 'Mini lanches': 1.4 }),
      B('Entregar fritos na hora (no local)?', { true: 1.3, false: 1 }),
    ],
  },

  // ════════════ 📚 EDUCAÇÃO E AULAS ════════════
  {
    group: 'educacao-aulas', name: 'Aulas de Natação', slug: 'aulas-natacao', icon: '🏊',
    description: 'Natação para bebês, crianças e adultos, na sua piscina ou do condomínio.', min: 60, max: 250, hours: 1,
    questions: [
      R('Para quem?', ['Bebê (até 3 anos)', 'Criança', 'Adulto iniciante', 'Adulto (aperfeiçoamento)'], { 'Bebê (até 3 anos)': 1.2, Criança: 1, 'Adulto iniciante': 1, 'Adulto (aperfeiçoamento)': 1.1 }),
      R('Aulas por semana?', ['1', '2', '3 ou mais'], { '1': 1, '2': 1.9, '3 ou mais': 2.7 }),
    ],
  },
  {
    group: 'educacao-aulas', name: 'Artes Marciais e Defesa Pessoal', slug: 'artes-marciais', icon: '🥋',
    description: 'Aulas particulares de jiu-jitsu, muay thai, boxe, karatê e defesa pessoal.', min: 60, max: 250, hours: 1,
    questions: [
      S('Modalidade?', ['Defesa pessoal', 'Jiu-jitsu', 'Muay thai', 'Boxe', 'Karatê', 'Outra'], undefined),
      R('Nível?', ['Iniciante', 'Intermediário', 'Avançado'], undefined),
      R('Aulas por semana?', ['1', '2', '3 ou mais'], { '1': 1, '2': 1.9, '3 ou mais': 2.7 }),
    ],
  },
  {
    group: 'educacao-aulas', name: 'Aula de Direção para Habilitados', slug: 'aula-direcao-habilitados', icon: '🚘',
    description: 'Perder o medo de dirigir: aulas práticas para quem já tem CNH.', min: 80, max: 250, hours: 1,
    questions: [
      R('Carro?', ['Do instrutor', 'O meu carro'], { 'Do instrutor': 1.3, 'O meu carro': 1 }),
      R('Câmbio?', ['Manual', 'Automático'], undefined),
      R('Quantas aulas?', ['1', 'Pacote de 5', 'Pacote de 10'], { '1': 1, 'Pacote de 5': 4.5, 'Pacote de 10': 8.5 }),
    ],
  },
  {
    group: 'educacao-aulas', name: 'Aulas de Libras', slug: 'aulas-libras', icon: '🤟',
    description: 'Língua Brasileira de Sinais para iniciantes e intermediários.', min: 60, max: 200, hours: 1,
    questions: [
      R('Nível?', ['Iniciante', 'Intermediário', 'Avançado'], undefined),
      R('Formato?', ['Presencial', 'Online'], { Presencial: 1, Online: 0.8 }),
    ],
  },
  {
    group: 'educacao-aulas', name: 'Robótica e Programação para Crianças', slug: 'robotica-programacao-infantil', icon: '🤖',
    description: 'Aulas de lógica, robótica, Scratch e programação para crianças e adolescentes.', min: 70, max: 250, hours: 1,
    questions: [
      R('Idade?', ['6 a 9 anos', '10 a 13 anos', '14 a 17 anos'], undefined),
      R('Formato?', ['Presencial', 'Online'], { Presencial: 1, Online: 0.8 }),
      B('A criança tem computador/tablet?'),
    ],
  },

  // ════════════ 🏥 SAÚDE E CUIDADOS ════════════
  {
    group: 'saude-em-casa', name: 'Terapia Ocupacional', slug: 'terapia-ocupacional', icon: '🧩',
    description: 'Atendimento domiciliar de terapia ocupacional para crianças, adultos e idosos.', min: 120, max: 300, hours: 1,
    questions: [
      R('Para quem?', ['Criança', 'Adulto', 'Idoso'], undefined),
      R('Sessões por semana?', ['1', '2', '3 ou mais'], { '1': 1, '2': 1.9, '3 ou mais': 2.7 }),
      D('Ex: criança com TEA, foco em coordenação motora e rotina', false),
    ],
  },
  {
    group: 'saude-em-casa', name: 'Doula', slug: 'doula', icon: '🤰',
    description: 'Acompanhamento na gestação, no parto e no pós-parto.', min: 600, max: 4000, hours: 8,
    questions: [
      R('Acompanhamento?', ['Gestação + parto', 'Só o parto', 'Pós-parto'], { 'Gestação + parto': 1.6, 'Só o parto': 1, 'Pós-parto': 0.8 }),
      N('Semanas de gestação', 'Ex: 28'),
    ],
  },
  {
    group: 'saude-em-casa', name: 'Acupuntura', slug: 'acupuntura', icon: '📍',
    description: 'Sessões de acupuntura em domicílio.', min: 100, max: 300, hours: 1,
    questions: [
      R('Quantas sessões?', ['1', 'Pacote de 5', 'Pacote de 10'], { '1': 1, 'Pacote de 5': 4.5, 'Pacote de 10': 8.5 }),
      D('Ex: dor lombar crônica, ansiedade, enxaqueca', false),
    ],
  },
  {
    group: 'saude-em-casa', name: 'Cuidador de Pessoa com Deficiência', slug: 'cuidador-pcd', icon: '♿',
    description: 'Cuidador para crianças e adultos com deficiência (apoio na rotina, higiene e locomoção).', min: 120, max: 400, hours: 8,
    questions: [
      R('Turno?', ['Meio período (até 6 h)', 'Período integral (8 a 12 h)', 'Noturno', '24 horas'], { 'Meio período (até 6 h)': 0.6, 'Período integral (8 a 12 h)': 1, 'Noturno': 1.2, '24 horas': 2 }),
      B('Precisa de ajuda para transferência (cama/cadeira)?', { true: 1.2, false: 1 }),
      D('Ex: adulto com paralisia cerebral, usa cadeira de rodas, precisa de ajuda no banho', false),
    ],
  },
  {
    group: 'saude-em-casa', name: 'Coleta de Exames em Casa', slug: 'coleta-exames-domicilio', icon: '🧪',
    description: 'Coleta domiciliar de sangue e outros materiais, com pedido médico.', min: 60, max: 250, hours: 1,
    questions: [
      R('Para quantas pessoas?', ['1', '2', '3 ou mais'], { '1': 1, '2': 1.7, '3 ou mais': 2.4 }),
      B('Tem pedido médico?'),
      B('A pessoa está acamada?', { true: 1.2, false: 1 }),
    ],
  },

  // ════════════ 🖥️ FREELANCERS DIGITAIS ════════════
  {
    group: 'freelancers-digitais', name: 'UX/UI Design (Apps e Sites)', slug: 'ux-ui-design', icon: '📐',
    description: 'Telas de aplicativo e site no Figma, protótipo e testes com usuários.', min: 400, max: 15000, hours: 30,
    questions: [
      R('O que precisa?', ['Telas de app', 'Telas de site', 'Redesign de produto existente', 'Protótipo navegável'], { 'Telas de app': 1.2, 'Telas de site': 1, 'Redesign de produto existente': 1.4, 'Protótipo navegável': 0.8 }),
      R('Quantas telas (aprox.)?', ['Até 5', '6 a 15', 'Mais de 15'], { 'Até 5': 1, '6 a 15': 2.2, 'Mais de 15': 4 }),
      D('Ex: app de agendamento para clínica, 10 telas, já tenho a identidade visual', true),
    ],
  },
  {
    group: 'freelancers-digitais', name: 'Ilustração', slug: 'ilustracao', icon: '🎨',
    description: 'Ilustração digital ou à mão para livros, embalagens, personagens e redes sociais.', min: 150, max: 5000, hours: 10,
    questions: [
      S('Uso?', ['Livro infantil', 'Personagem/mascote', 'Embalagem/rótulo', 'Retrato', 'Redes sociais'], undefined),
      N('Quantas ilustrações?', 'Ex: 3'),
      D('Ex: mascote de um cachorro para pet shop, estilo cartoon, colorido', true),
    ],
  },
  {
    group: 'freelancers-digitais', name: 'Edição e Tratamento de Fotos', slug: 'edicao-fotos', icon: '🖼️',
    description: 'Tratamento, recorte de fundo, restauração de fotos antigas e montagens.', min: 30, max: 1500, hours: 3,
    questions: [
      R('Serviço?', ['Tratamento/cor', 'Recorte de fundo (produto)', 'Restauração de foto antiga', 'Montagem'], { 'Tratamento/cor': 1, 'Recorte de fundo (produto)': 0.6, 'Restauração de foto antiga': 1.8, Montagem: 1.4 }),
      N('Quantas fotos?', 'Ex: 20'),
    ],
  },
  {
    group: 'freelancers-digitais', name: 'SEO (Google)', slug: 'seo-sites', icon: '📈',
    description: 'Otimização do site para aparecer no Google: auditoria, conteúdo e Google Meu Negócio.', min: 300, max: 5000, hours: 15,
    questions: [
      R('Serviço?', ['Auditoria de SEO', 'SEO mensal', 'Google Meu Negócio', 'SEO de loja virtual'], { 'Auditoria de SEO': 0.6, 'SEO mensal': 1.5, 'Google Meu Negócio': 0.4, 'SEO de loja virtual': 1.8 }),
      B('Já tem site no ar?'),
    ],
  },

  // ════════════ 💼 NEGÓCIOS E ESCRITÓRIO ════════════
  {
    group: 'negocios-escritorio', name: 'Currículo e LinkedIn', slug: 'curriculo-linkedin', icon: '📄',
    description: 'Criação e revisão de currículo e perfil do LinkedIn; preparação para entrevista.', min: 50, max: 500, hours: 2,
    questions: [
      R('Serviço?', ['Currículo', 'Currículo + LinkedIn', 'Preparação para entrevista', 'Pacote completo'], { Currículo: 1, 'Currículo + LinkedIn': 1.7, 'Preparação para entrevista': 1.3, 'Pacote completo': 2.5 }),
      R('Nível?', ['Primeiro emprego', 'Pleno', 'Gestão/executivo'], { 'Primeiro emprego': 0.8, Pleno: 1, 'Gestão/executivo': 1.6 }),
    ],
  },
  {
    group: 'negocios-escritorio', name: 'Síndico Profissional', slug: 'sindico-profissional', icon: '🏘️',
    description: 'Gestão de condomínio por síndico profissional ou assessoria ao síndico.', min: 800, max: 8000, hours: 20,
    questions: [
      N('Número de unidades', 'Ex: 48'),
      R('Serviço?', ['Síndico profissional', 'Assessoria ao síndico', 'Auditoria de contas'], { 'Síndico profissional': 1, 'Assessoria ao síndico': 0.6, 'Auditoria de contas': 0.5 }),
    ],
  },

  // ════════════ 🧵 MODA E COSTURA ════════════
  {
    group: 'moda-costura', name: 'Conserto de Joias e Relógios', slug: 'conserto-joias', icon: '💍',
    description: 'Solda, ajuste de anel, troca de fecho, banho de ouro e troca de bateria de relógio.', min: 30, max: 800, hours: 1,
    questions: [
      S('Serviço?', ['Ajuste de tamanho de anel', 'Solda de corrente', 'Troca de fecho', 'Banho de ouro/ródio', 'Bateria/conserto de relógio'], { 'Ajuste de tamanho de anel': 1, 'Solda de corrente': 0.8, 'Troca de fecho': 0.6, 'Banho de ouro/ródio': 1.5, 'Bateria/conserto de relógio': 0.7 }),
      N('Quantas peças?', 'Ex: 2'),
    ],
  },
  {
    group: 'moda-costura', name: 'Bordado e Customização', slug: 'bordado-customizacao', icon: '🧶',
    description: 'Bordado à mão ou à máquina, nomes, logotipos e customização de roupas.', min: 30, max: 1000, hours: 3,
    questions: [
      R('Tipo?', ['Nome/monograma', 'Logotipo (uniformes)', 'Bordado artístico', 'Customização (patches, pintura)'], { 'Nome/monograma': 0.6, 'Logotipo (uniformes)': 1, 'Bordado artístico': 1.8, 'Customização (patches, pintura)': 1.2 }),
      N('Quantas peças?', 'Ex: 10'),
    ],
  },
]

export async function seedCatalogV3(prisma: PrismaClient) {
  const grupos = await prisma.serviceGroup.findMany({ select: { id: true, slug: true } })
  const groupId = Object.fromEntries(grupos.map((g) => [g.slug, g.id]))
  let garantidas = 0
  for (const cat of CATALOGO_V3) {
    const gid = groupId[cat.group]
    if (!gid) {
      console.warn(`⚠️  Catálogo v3: grupo "${cat.group}" não encontrado — pulando ${cat.slug}`)
      continue
    }
    const registro = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
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
    garantidas++
  }
  console.log(`✅ Catálogo v3: ${garantidas} categorias novas garantidas`)
}

// Execução avulsa: `npx ts-node prisma/seed-catalog-v3.ts`
if (require.main === module) {
  const prisma = new PrismaClient()
  seedCatalogV3(prisma)
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())
}
