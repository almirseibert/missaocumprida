# Remap 2.0 — Missão Cumprida

> Blueprint de redesenho do produto: nova identidade visual, catálogo expandido de serviços
> e pagamentos no modelo Uber/99 (cobrança in-app + split automático + repasse ao prestador).
>
> Referências usadas: **Thumbtack** (perfis de profissional, busca-primeiro, selos de confiança),
> **TaskRabbit** (reserva imediata por hora, mudanças/montagem, visual verde amigável),
> **GetNinjas** (taxonomia BR de reformas/assistência técnica), **Craigslist** (amplitude de
> "gigs"/tarefas avulsas). Modelo de pagamento: **Uber** e **99**.
>
> Data: 07/07/2026 · Documento de decisão — nada aqui foi implementado ainda.

---

## 0. TL;DR

| Frente | Hoje | Decidido |
|---|---|---|
| Visual | Azul Confiança sobre cinza-ardósia, denso | **"Verde Missão"** (aprovado): CTA verde-esmeralda, fundo papel quente, fotos grandes — o ✓ de "missão cumprida" vira a marca |
| Catálogo | 12 grupos · 79 categorias | **17 grupos · ~160 categorias** (✅ implementado no seed: `backend/prisma/seed-remap2.ts`) |
| Pagamento | Escrow do valor do serviço com aprovação manual | **Taxa de Conexão 10%+10%** (✅ implementado): cada lado paga a taxa para liberar o contato; promo de lançamento 5% (10% riscado); **o serviço é pago direto entre as partes** — a plataforma nunca custodia |

---

## 1. Onde estamos

- **Stack**: Express+Prisma+Postgres · Next.js 14 · Expo/React Native (NativeWind).
- **Fluxo**: pedido com questionário dinâmico → propostas → aceite → agendamento → conclusão → confirmação do cliente → pagamento retido 7 dias (`HELD`) + aprovação manual do admin → saldo virtual → saque manual.
- **Gateways**: Stripe (cartão) + Mercado Pago (Pix) — dois trilhos separados.
- **Riscos já mapeados** (`MANUTENCAO_E_CONFORMIDADE.md`): custódia do dinheiro na conta da plataforma com repasse manual ≈ arranjo de pagamento (BACEN, Lei 12.865/2013). A recomendação registrada lá — *"avaliar split/subconta do gateway"* — é exatamente o modelo Uber/99 deste remap.
- **Google Play**: pagamento de serviço físico fora do Play Billing é permitido; só o Selo Pro precisa de Play Billing (já migrado para RevenueCat).

---

## 2. Visual novo — direção "Verde Missão"

### 2.1 Conceito

O nome do app é o ativo: **"missão cumprida" = check verde**. A identidade inverte a paleta atual —
o verde (hoje mero acento) vira a **cor de ação**, e o azul-marinho vira cor institucional de
confiança (selos, links, verificação). Sai o cinza-ardósia frio, entra **fundo papel quente**.

O que pegamos de cada referência:

- **Thumbtack** → home busca-primeiro; card de profissional com foto, nota, nº de contratações e resposta média; selos de credencial ("Verificado", "Top Pro"); orçamentos comparáveis lado a lado.
- **TaskRabbit** → verde como cor de marca; **reserva imediata com preço por hora** (escolhe o profissional pela tabela dele, sem leilão); tom de voz leve; ilustrações simples.
- **GetNinjas** → grade de categorias com ícones grandes que o brasileiro reconhece; wizard de pedido curto (3–4 passos).
- **Uber/99** → checkout de 1 tela: método de pagamento salvo + resumo + botão único; recibo com divisão transparente; carteira do prestador estilo "ganhos do motorista".

### 2.2 Tokens de design

Fontes **mantidas** (Plus Jakarta Sans para display, DM Sans para corpo — já carregadas no app,
migração barata). O que muda é paleta, escala e raio.

```js
// tailwind.config.js (mobile e web) — Remap 2.0
colors: {
  // Verde Missão — PRIMÁRIA de ação (antes "accent")
  brand: {
    50:'#ECFDF5', 100:'#D1FAE5', 200:'#A7F3D0', 300:'#6EE7B7',
    400:'#34D399', 500:'#10B981', 600:'#059669', 700:'#047857',
    800:'#065F46', 900:'#064E3B',
  },
  // Azul Confiança — secundária institucional (selos, links, verificação)
  trust: {
    50:'#EFF6FF', 100:'#DBEAFE', 500:'#3B82F6', 600:'#2563EB',
    700:'#1D4ED8', 900:'#1E3A8A',
  },
  // Papel quente — fundos (substitui slate-50/100 frios)
  paper:   { DEFAULT:'#F8F7F4', card:'#FFFFFF', sunken:'#F1EFEA' },
  // Tinta — textos (grafite, não preto)
  ink:     { DEFAULT:'#101828', soft:'#475467', mute:'#98A2B3' },
  // Âmbar — estrelas/avaliações e alertas leves
  star:    { 400:'#FBBF24', 500:'#F59E0B' },
  danger:  { 500:'#EF4444', 600:'#DC2626' },
},
borderRadius: { card:'20px', chip:'14px', pill:'999px' },
// Sombra única e suave: 0 1px 2px rgba(16,24,40,.06), 0 4px 12px rgba(16,24,40,.06)
```

Regras de uso:

1. **Um CTA verde por tela.** Todo o resto é neutro ou outline — como Uber (um botão preto) e TaskRabbit (um botão verde).
2. **Azul só significa confiança**: selo Verificado Pro, link, "Segurança de Transação". Nunca em botão de ação.
3. **Âmbar só para estrelas.** Nota sempre no formato `★ 4,9 (127)`.
4. **Fotos > ícones**: card de prestador leva foto real 56–64px; categoria leva emoji em "squircle" 48px sobre `brand-50`.

### 2.3 Componentes-chave (novos ou redesenhados)

| Componente | Referência | Especificação |
|---|---|---|
| `SearchHero` | Thumbtack | Campo de busca gigante no topo da home: "O que você precisa hoje?" com sugestões por histórico/estação |
| `CategoryChip` | GetNinjas | Squircle 48px + emoji + label 12px; grade 4 colunas; "Ver todos" abre catálogo completo |
| `ProCard` | Thumbtack/TaskRabbit | Foto, nome, selo Pro azul, `★ 4,9 (127)`, "342 serviços", preço ("a partir de R$ 120" ou "R$ 90/h"), tag verde `Reserva Imediata` quando aplicável |
| `PriceBreakdown` | Uber/99 | Linhas: serviço + taxa de serviço + cupom − desconto = **total**; expansível no recibo |
| `PaymentMethodRow` | Uber/99 | Bandeira/ícone + `•••• 4242` + "Padrão"; troca via bottom sheet |
| `TrustBanner` | — | Faixa azul-clara "🛡️ Segurança de Transação: o valor só é liberado ao profissional 7 dias após a conclusão" |
| `EarningsCard` | Uber (motorista) | Carteira do prestador: saldo disponível, a liberar (D+7), próximo repasse automático, extrato |
| `TipSheet` | Uber/99 | Pós-avaliação 5★: gorjeta R$ 5/10/20/outro — 100% para o profissional |

### 2.4 Tela a tela (mobile — telas em `mobile/app/(app)`)

| Tela | Hoje | Remap 2.0 |
|---|---|---|
| `home.tsx` | Lista de grupos | SearchHero → "Reservar de novo" (recorrência) → grade de categorias → carrossel "Profissionais bem avaliados perto de você" → banner Segurança de Transação |
| Categoria (novo) | Vai direto ao pedido | **Duas abas estilo TaskRabbit**: "Reserva Imediata" (lista de ProCards com preço/h, escolhe e agenda direto) e "Pedir Orçamentos" (wizard atual) |
| `pedido/*` | Formulário longo | Wizard 4 passos com barra de progresso: O quê → Detalhes (questionário) → Onde/Quando → **Revisão com estimativa de preço em destaque** |
| Checkout (novo) | Pagamento após confirmação, em tela separada | **1 tela estilo Uber**: resumo + PriceBreakdown + método salvo + botão "Confirmar serviço" — o cartão é só *autorizado*; captura na conclusão |
| Perfil do prestador | Básico | Estilo Thumbtack: capa, foto, selos (Verificado Pro azul, Top Prestador), nota + distribuição de estrelas, fotos de trabalhos, avaliações com resposta, botões "Reservar"/"Pedir orçamento" |
| `carteira.tsx` | Saldo + saque manual | EarningsCard estilo Uber: disponível / a liberar (com data) / repasse automático configurável / extrato com PriceBreakdown por serviço |
| `dashboard.tsx` (prestador) | Métricas simples | "Ganhos da semana" em destaque (gráfico de barras), taxa de aceitação, tempo de resposta — gamificação leve estilo 99 |

**Mockup navegável**: [novovisual/Remap 2.0.html](novovisual/Remap%202.0.html) — paleta, tipografia, componentes e 4 telas montadas.

### 2.5 O que muda no código

- `tailwind.config.js` (mobile) e config do frontend: novos tokens acima; `brand` azul atual vira `trust`, `accent` verde vira `brand` — busca-e-troca de classes com codemod simples.
- Sem troca de fontes → sem mudança em `expo-font`/build.
- Componentes novos em `mobile/src/components/` (ProCard, PriceBreakdown, PaymentMethodRow, TipSheet, EarningsCard).
- Frontend web acompanha com os mesmos tokens (o design system já é espelhado).

---

## 3. Catálogo expandido — de 79 para ~155 serviços

### 3.1 Nova taxonomia (17 grupos)

Reorganização: **"Serviços Gerais" é aposentado** (era gaveta de miscelânea) e seus itens são
redistribuídos; nascem 7 grupos novos (🆕). Ordem pensada para a grade da home:

1. 🏠 Para Sua Casa — reparos e instalações
2. 🧱 **Reformas e Construção** 🆕 (núcleo GetNinjas)
3. 🧺 **Limpeza e Doméstico** 🆕 (absorve limpezas + lavanderia + diarista)
4. 🔌 **Assistência Técnica** 🆕 (absorve conserto de eletrodomésticos/computador)
5. 🚚 **Mudanças e Carretos** 🆕 (núcleo TaskRabbit; absorve Frete e Transporte)
6. 🚗 Para Seu Carro
7. 💇 Beleza e Estética
8. 🐾 Para Seu Pet
9. 💻 Tech e Digital
10. 📦 Entregas e Tarefas (renomeado; absorve motoboy/compras + "gigs" Craigslist)
11. 🎉 Eventos e Festas
12. 📚 Educação e Aulas
13. 🏋️ Fitness e Bem-Estar
14. 🏥 Saúde e Cuidados (renomeado "Saúde em Casa")
15. 🖥️ Freelancers Digitais
16. 💼 **Negócios e Escritório** 🆕
17. 🧵 **Moda e Costura** 🆕

### 3.2 Novas categorias (76)

Modo: **RI** = elegível a Reserva Imediata (preço fechado) · **OR** = orçamento.

**🧱 Reformas e Construção** (novas 10 + migram: Piso/Azulejista, Gesseiro, Serralheria, Impermeabilização, Limpeza de Telhado)

| Categoria | Ícone | Faixa R$ | Modo |
|---|---|---|---|
| Pedreiro / Alvenaria | 🧱 | 150–2.000 | OR |
| Reforma de Banheiro | 🚿 | 800–8.000 | OR |
| Reforma de Cozinha | 🍳 | 1.000–12.000 | OR |
| Vidraçaria / Box e Espelhos | 🪞 | 150–1.500 | OR |
| Calhas e Rufos | 🌧️ | 150–1.200 | OR |
| Construção/Reforma de Telhado | 🏗️ | 300–5.000 | OR |
| Instalação de Energia Solar | ☀️ | 500–5.000 | OR |
| Aquecedor a Gás / Solar | 🔥 | 200–1.500 | OR |
| Demolição e Retirada de Entulho | 🗑️ | 200–1.500 | OR |
| Arquiteto / Projeto e Laudo | 📐 | 300–5.000 | OR |

**🧺 Limpeza e Doméstico** (novas 7 + migram: Limpeza Residencial, Limpeza Pós-obra, Limpeza de Sofá, Lavanderia, Limpeza de Piscina)

| Categoria | Ícone | Faixa R$ | Modo |
|---|---|---|---|
| Diarista (recorrente) | 🧹 | 120–350/diária | **RI** |
| Passadeira de Roupas | 👔 | 80–250 | **RI** |
| Cozinheira Semanal / Marmitas | 🍲 | 100–500 | OR |
| Limpeza de Caixa d'Água | 💧 | 150–500 | **RI** |
| Limpeza de Vidros e Fachadas | 🪟 | 150–1.500 | OR |
| Limpeza de Tapetes e Cortinas | 🧼 | 100–500 | **RI** |
| Caseiro / Zelador | 🏡 | 150–500 | OR |

**🔌 Assistência Técnica** (novas 9 + migram: Conserto de Eletrodomésticos, Conserto de Computador)

| Categoria | Ícone | Faixa R$ | Modo |
|---|---|---|---|
| Conserto de Celular / Tablet | 📱 | 80–600 | **RI** |
| Conserto de Geladeira / Freezer | 🧊 | 120–800 | OR |
| Conserto de Máquina de Lavar | 🌀 | 120–700 | OR |
| Conserto de Fogão / Cooktop | 🔥 | 80–500 | **RI** |
| Conserto de Micro-ondas | ⚡ | 80–400 | **RI** |
| Conserto de TV | 📺 | 100–800 | OR |
| Conserto de Videogame | 🎮 | 100–500 | OR |
| Conserto de Impressora | 🖨️ | 80–400 | **RI** |
| Eletroportáteis (airfryer, cafeteira…) | ☕ | 60–300 | **RI** |

**🚚 Mudanças e Carretos** (novas 5 + migra: Frete e Transporte)

| Categoria | Ícone | Faixa R$ | Modo |
|---|---|---|---|
| Mudança Completa | 🚚 | 300–3.000 | OR |
| Carreto / Frete Pequeno | 🛻 | 80–500 | **RI** |
| Ajudante de Carga e Descarga | 💪 | 80–300 | **RI** |
| Embalagem para Mudança | 📦 | 100–600 | **RI** |
| Içamento de Móveis | 🪟 | 300–2.000 | OR |

**💼 Negócios e Escritório** (novas 8)

| Categoria | Ícone | Faixa R$ | Modo |
|---|---|---|---|
| Assistente Virtual / Secretariado | 💻 | 50–300 | **RI** |
| Contabilidade / Imposto de Renda | 📊 | 150–800 | OR |
| Tradução e Revisão de Textos | 🌐 | 80–500 | OR |
| Digitação e Transcrição | ⌨️ | 50–300 | **RI** |
| Panfletagem / Promotor | 📣 | 80–300 | **RI** |
| Segurança / Portaria para Eventos | 🛡️ | 150–600 | OR |
| Despachante / Documentos | 📄 | 100–600 | OR |
| Consultoria Financeira Pessoal | 💰 | 150–800 | OR |

**🧵 Moda e Costura** (novas 5)

| Categoria | Ícone | Faixa R$ | Modo |
|---|---|---|---|
| Costureira / Ajustes de Roupa | 🧵 | 30–300 | **RI** |
| Conserto de Sapatos e Bolsas | 👞 | 30–200 | **RI** |
| Tapeçaria / Reforma de Estofados | 🛋️ | 200–2.000 | OR |
| Personal Stylist / Consultoria de Imagem | 👗 | 150–800 | OR |
| Lavagem de Tênis | 👟 | 40–150 | **RI** |

**Reforço nos grupos existentes** (32 novas):

| Grupo | Novas categorias |
|---|---|
| 🏠 Casa | Automação Residencial / Alexa 🏠 · Papel de Parede 🖼️ · Redes de Proteção 🥅 · Horta em Casa 🌱 (4) |
| 🚗 Carro | Martelinho de Ouro 🔨 · Troca de Para-brisa/Vidros 🚘 · Elétrica Automotiva 🔋 · Mecânica de Motos 🏍️ · Higienização do Ar Automotivo 🌬️ · Envelopamento 🎨 (6) |
| 💇 Beleza | Tranças e Cabelo Afro 👩🏾‍🦱 · Alongamento de Cílios 👁️ · Podologia 🦶 · Dia da Noiva 👰 (4) |
| 🐾 Pet | Pet Sitter (na sua casa) 🏠 · Vacinação em Domicílio 💉 (2) |
| 📦 Entregas e Tarefas | Fila e Espera ⏳ · Ajudante Geral por Hora 💪 · Doações e Descarte ♻️ · Cuidar da Casa em Viagem 🏠 · Regar Plantas em Viagem 🪴 · Decoração Sazonal (Natal) 🎄 (6, estilo Craigslist gigs/TaskRabbit errands) |
| 🎉 Eventos | Buffet Completo 🍽️ · Bolos e Doces 🎂 · Aluguel de Brinquedos 🎠 · Cerimonialista 💍 · Cabine de Fotos 📸 · Churrasqueiro 🍖 (6) |
| 📚 Educação | Preparatório ENEM/Concursos 📝 · Tecnologia para Idosos 📱 (2) |
| 🏥 Saúde | Acompanhante Hospitalar 🏥 · Fonoaudiologia 🗣️ · Aplicação de Injetáveis 💉 (3) |
| 💻 Tech | Instalação de Antenas / Starlink 📡 (1) |
| 🖥️ Freelancers | Tráfego Pago 💹 · Loja Virtual / E-commerce 🛒 · Fotografia de Produto 📷 · Locução e Narração 🎙️ · Automação com IA / Chatbots 🤖 (5) |

**Total: 76 novas → ~155 categorias.**

### 3.3 Reserva Imediata vs Orçamento (o híbrido TaskRabbit + Thumbtack)

- **Reserva Imediata (RI)**: para serviços padronizáveis (diarista, carreto, conserto de celular…). O prestador define **tabela de preço** (por hora ou por serviço com modificadores do questionário). O cliente escolhe o profissional pela lista (ProCard), vê **preço fechado antes de confirmar** — o "upfront pricing" do Uber — e agenda direto, sem leilão de propostas.
- **Orçamento (OR)**: fluxo atual (questionário → até N propostas → cliente compara). Mantido para serviços complexos (reforma, funilaria…).
- Novo campo em `categories`: `booking_mode: INSTANT | QUOTE | BOTH`. Nova tabela `provider_rates` (provider_id, category_id, hourly_rate | fixed_price, min_charge).

### 3.4 Questionários — 3 exemplos no padrão do seed (os demais seguem o mesmo molde)

```ts
// Diarista (recorrente) — RI
{ question: 'Tamanho do imóvel?', field_type: 'SELECT',
  options: ['Kitnet/Studio','1 dorm','2 dorms','3 dorms','4+ dorms'],
  affects_price: true, price_modifier: { 'Kitnet/Studio':0.7,'1 dorm':1,'2 dorms':1.3,'3 dorms':1.6,'4+ dorms':2 }, is_required: true },
{ question: 'Frequência?', field_type: 'RADIO',
  options: ['1x por semana','2x por semana','Quinzenal','Avulsa'],
  affects_price: true, price_modifier: { '1x por semana':0.9,'2x por semana':0.85,'Quinzenal':0.95,'Avulsa':1 }, is_required: true },
{ question: 'Inclui passar roupa?', field_type: 'BOOLEAN', affects_price: true,
  price_modifier: { 'true':1.2,'false':1 }, is_required: true },
{ question: 'Tem pets em casa?', field_type: 'BOOLEAN', is_required: true },

// Conserto de Geladeira / Freezer — OR
{ question: 'Qual o problema?', field_type: 'SELECT',
  options: ['Não gela','Gela demais/congela tudo','Fazendo barulho','Vazando água','Não liga','Porta não veda','Outro'],
  affects_price: true, price_modifier: { 'Não liga':1.4,'Não gela':1.3,'Porta não veda':0.7 }, is_required: true },
{ question: 'Marca e modelo', field_type: 'TEXT', is_required: true, placeholder: 'Ex: Brastemp Frost Free 375L' },
{ question: 'Idade aproximada do aparelho?', field_type: 'RADIO',
  options: ['Até 2 anos','2–5 anos','5–10 anos','Mais de 10 anos'], affects_price: false, is_required: true },
{ question: 'Foto do aparelho / etiqueta', field_type: 'PHOTO', is_required: true },

// Carreto / Frete Pequeno — RI
{ question: 'O que será transportado?', field_type: 'SELECT',
  options: ['Poucos itens (caixas)','1 móvel grande','Vários móveis','Eletrodoméstico grande'],
  affects_price: true, price_modifier: { 'Poucos itens (caixas)':1,'1 móvel grande':1.3,'Vários móveis':2,'Eletrodoméstico grande':1.5 }, is_required: true },
{ question: 'Distância aproximada?', field_type: 'SELECT',
  options: ['Até 5km','5–15km','15–40km','Acima de 40km'],
  affects_price: true, price_modifier: { 'Até 5km':1,'5–15km':1.4,'15–40km':2,'Acima de 40km':3 }, is_required: true },
{ question: 'Tem escada/elevador na origem ou destino?', field_type: 'RADIO',
  options: ['Térreo dos dois lados','Escada (até 2 andares)','Escada (3+ andares)','Elevador'],
  affects_price: true, price_modifier: { 'Térreo dos dois lados':1,'Escada (até 2 andares)':1.3,'Escada (3+ andares)':1.6,'Elevador':1.1 }, is_required: true },
{ question: 'Precisa de ajudante extra?', field_type: 'BOOLEAN', affects_price: true,
  price_modifier: { 'true':1.4,'false':1 }, is_required: true },
```

### 3.5 Migração

- Seed idempotente (já usa `upsert` por slug): adicionar grupos/categorias novos e atualizar `group_id` das que migram — **slugs não mudam**, pedidos antigos continuam válidos.
- `ServiceGroup` "Serviços Gerais" fica `is_active=false` após redistribuição (não deletar).

---

## 4. Pagamentos — Taxa de Conexão (✅ decidido e implementado em 10/07/2026)

> O modelo split/escrow estilo Uber-99 foi rejeitado (risco de desintermediação). Modelo
> final proposto pelo dono do produto: **monetizar o match, não a transação**.

### 4.1 O modelo

- Ao aceitar uma proposta, **cada lado paga uma Taxa de Conexão** sobre o valor da proposta
  para **liberar o contato** (telefone, endereço completo e chat).
- **Promoção de lançamento**: 5% de cada lado, com os **10% exibidos riscados** na UI
  ("de ~~10%~~ por 5%"), até nova versão.
- **Taxas configuráveis pelo admin em runtime** (painel → Configurações; tabela
  `platform_settings`; apps leem `GET /api/config/public` — sem redeploy).
- **Taxa mínima** por lado: R$ 4,90 (antifraude, configurável).
- **Repasse do meio de pagamento sobre a taxa**: +4% cartão / +1% Pix
  (ex.: taxa de R$ 5,00 no cartão → R$ 5,20).
- **O pagamento do serviço é direto entre cliente e prestador** — a plataforma nunca
  custodia o valor do serviço (elimina o risco BACEN apontado na auditoria).
- Gorjeta (fase futura): pós-avaliação, via Pix, credita `provider_balance`.

### 4.2 Fluxo implementado

```
Cliente aceita proposta (R$ 200)
  └─ Order ACCEPTED + 2 ConnectionFee PENDING (cliente R$ 10, prestador R$ 10 na promo)
Cliente paga a taxa dele (Pix MP; crédito da plataforma abatido automaticamente)
  └─ prestador é notificado: prazo de 24h para pagar a taxa dele
Prestador paga (saldo interno OU Pix)
  └─ Order SCHEDULED → contatos liberados dos dois lados + chat aberto
     (serviço executado; pagamento combinado direto entre as partes)
Prestador não paga no prazo (cron 15min)
  └─ taxa do prestador EXPIRED · cliente RECREDITADO na hora · propostas
     rejeitadas voltam a PENDING · pedido reabre (IN_PROPOSAL/OPEN)
```

### 4.3 Garantia de Conexão (créditos automáticos)

- Prestador não confirma / cancela / não comparece → taxa do cliente **vira crédito
  automaticamente** (`credit_balance` + ledger `CreditTransaction`), abatida na próxima taxa.
- Cliente cancela antes da conexão → crédito integral, sem punição.
- Estorno bancário: só manual, pela fila admin (Taxas de Conexão → Estornar).

### 4.4 Antibypass e banimentos (Termos v1.3.0)

1. **Contato bloqueado até pagar**: telefone/endereço mascarados nas APIs e chat com 403
   até o pedido virar SCHEDULED; mensagem da proposta passa por sanitizador de contato
   (telefone/e-mail/@/links → "[removido]").
2. **Piso antifraude**: proposta mínima = 40% do `base_price_min` da categoria + taxa mínima.
3. **Banimentos automáticos**: cliente que cancela após receber os dados → banido;
   prestador que cancela após receber os dados → banido; reclamação de no-show → prestador
   suspenso na hora + fila admin confirma o ban; má-fé → ban manual do admin. Banido não loga.
4. Proteções/avaliações só existem dentro do app; receber por fora = quebra dos termos.

### 4.5 O que foi implementado (arquivos-chave)

- **Schema**: `ConnectionFee`, `PlatformSetting`, `Announcement` + campos em Order/User
  (migração `connection_fee`, aditiva; `Payment` congelado como legado até zerar HELD).
- **Backend**: `payments/connectionFees.service.ts` + `.controller.ts` (checkout, saldo,
  crédito, timeout, admin), `settings/` (config runtime), `announcements/` (avisos + push),
  `users/moderation.service.ts` (ban), `users/deletion.service.ts` (exclusão c/ 7 dias de
  arrependimento), gates de contato em orders/schedules/messages/realtime, webhook MP roteia
  `fee_<id>`. **Stripe removido** (Mercado Pago único gateway).
- **Mobile**: `pagamento/[orderId]` (checkout da taxa c/ promo riscada), nova
  `taxa-conexao/[orderId]` (prestador), banners em `pedido/[id]`, CTA em minhas-propostas,
  créditos na carteira, `AnnouncementsGate` (pop-ups do admin).
- **Web**: pagamento sem Stripe, `/cancelar-assinatura` (pública), admin → Configurações,
  Taxas de Conexão e avisos em Comunicação.
- **Legal**: termos v1.3.0 (§4 Taxa de Conexão, §5 garantia/banimentos, CDC art. 49).

---

## 5. Roadmap — status

| Fase | Escopo | Status |
|---|---|---|
| **Catálogo** | Seed: 17 grupos, +80 categorias c/ questionários, migração de grupos | ✅ Feito (`seed-remap2.ts`) — falta rodar migração+seed no servidor |
| **Pagamento (Taxa de Conexão)** | ConnectionFee, config runtime, gates de contato/chat, no-show/créditos, banimentos, avisos admin, cancelamento de assinatura, remoção do Stripe | ✅ Feito — falta migração em prod + envs |
| **Visual "Verde Missão"** | Tokens novos, home busca-primeiro, ProCard, perfil do prestador — mobile primeiro, web espelha | ⏳ Próximo (mockup aprovado) |
| **Extras** | Gorjeta, cupons, Reserva Imediata (ProviderRate), cartão MP (Checkout Pro), `booking_mode` | ⏳ Backlog |

## 6. Decisões tomadas (09–10/07/2026)

1. **Modelo Taxa de Conexão** — cliente e prestador pagam para desbloquear o contato; serviço pago direto entre as partes. Taxa cheia **10% + 10%**; **lançamento promocional 5% + 5%** com o valor cheio riscado na UI.
2. **Taxas alteráveis pelo admin em runtime** (sistema + mobile refletem sem redeploy).
3. **Repasse de gateway sobre a taxa**: +4% cartão / +1% Pix (nota: taxa de R$ 5,00 no cartão = R$ 5,20).
4. **No-show → crédito automático**; estorno bancário só manual (admin).
5. **Banimentos**: cancelamento pós-liberação (qualquer lado), no-show confirmado e má-fé contra a taxa.
6. **Mercado Pago único gateway** — Stripe aposentado. **Sem dinheiro em espécie** no lançamento.
7. **Revisão por exceção** no lugar de aprovação manual por transação (fila admin só para disputas).
8. **Visual "Verde Missão" aprovado** pelo mockup; visual e catálogo podem andar em paralelo com pagamentos.

### A calibrar durante a operação
- Percentual/duração da promoção de lançamento (troca no painel admin).
- Taxa mínima (R$ 4,90) e piso de proposta (40% do mínimo da categoria).
- Prazo do prestador (24h) para pagar a taxa após o cliente.
