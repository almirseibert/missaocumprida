# Plano de Implantação — Evolução do Missão Cumprida

> Documento de planejamento das próximas evoluções do marketplace.
> Cada feature contempla **Backend**, **Frontend Web (Next.js)** e **Mobile (Expo)**.
> Última atualização: 2026-06-07 (Sem 11-12 concluída — Trilha B 100%)

## Status de execução

| # | Feature | Backend | Web | Mobile |
|---|---------|---------|-----|--------|
| 9 | Push real (FCM/APNs/WebPush) | ✅ | ✅ | ✅ |
| 11 | Onboarding guiado | ✅ | ✅ | ✅ |
| 14 | Expansão de categorias (fase 1) | ✅ | ✅ | ✅ |
| 15 | Precificação dinâmica | ✅ | ✅ | ✅ |
| 4 | Programa de indicação | ✅ | ✅ | ✅ |
| 13 | Compartilhamento público | ✅ | ✅ | ✅ |
| 12 | Dashboard analítico do prestador | ✅ | ✅ | ✅ |
| 10 | Chat em tempo real | ✅ | ✅ | ✅ |
| 2 | Pacotes de serviço | ✅ | ✅ | ✅ |
| 3 | Agenda pública | ✅ | ✅ | ✅ |
| 1 | Recorrência / assinatura | ✅ | ✅ | ✅ |
| 5 | Modo urgência | ✅ | ✅ | ✅ |
| 6 | Boost de proposta | ✅ | ✅ | ✅ |
| 7 | Selo verificado | ✅ | ✅ | ✅ |
| 8 | Cross-sell | ✅ | ✅ | ✅ |

---

## Índice

1. [Visão Geral e Estratégia de Execução](#0-visão-geral)
2. [Recorrência / Assinatura de Serviços](#1-recorrência--assinatura)
3. [Pacotes de Serviço](#2-pacotes-de-serviço)
4. [Agenda Pública do Prestador (Calendly-style)](#3-agenda-pública)
5. [Programa de Indicação com Crédito](#4-programa-de-indicação)
6. [Modo Urgência (push em raio)](#5-modo-urgência)
7. [Boost de Proposta](#6-boost-de-proposta)
8. [Selo "Profissional Verificado" (assinatura)](#7-selo-verificado)
9. [Cross-sell de Serviços](#8-cross-sell)
10. [Notificações Push Reais (FCM/APNs)](#9-push-real)
11. [Chat em Tempo Real (Socket.io)](#10-chat-realtime)
12. [Onboarding Guiado — Prestador e Cliente](#11-onboarding)
13. [Dashboard Analítico do Prestador](#12-dashboard-prestador)
14. [Compartilhamento de Pedido (link público)](#13-link-público)
15. [Expansão de Categorias (replicar GetNinjas)](#14-expansão-categorias)
16. [Precificação Dinâmica por Questionário](#15-precificação-dinâmica)
17. [Cronograma Sugerido (Roadmap)](#16-roadmap)

---

## 0. Visão Geral

### Princípios de execução
- **Paridade web ⇄ mobile**: toda feature de usuário final entra nas duas plataformas. Backend é fonte única de verdade.
- **Migrations encadeadas, sem breaking**: cada feature adiciona campos opcionais primeiro; defaults seguros.
- **Feature flags por usuário/categoria** em `User.feature_flags` (JSON) — permite rollout gradual.
- **Tipos compartilhados**: `frontend/src/types/index.ts` e `mobile/src/types/index.ts` espelham as mesmas interfaces — manter sincronizados a cada PR.
- **Sem quebrar APIs existentes**: novos endpoints sob `/api/v2/...` quando houver mudança de shape.

### Convenções de pastas (novos módulos)
```
backend/src/modules/
├── subscriptions/       # Recorrência
├── packages/            # Pacotes
├── availability/        # Agenda pública
├── referrals/           # Indicação
├── urgency/             # Modo urgência
├── boost/               # Boost de proposta
├── verification/        # Selo verificado
├── recommendations/     # Cross-sell
├── push/                # FCM/APNs
├── realtime/            # Socket.io
├── onboarding/          # Onboarding state
├── analytics/           # Dashboard prestador
└── public-share/        # Link público
```

---

## 1. Recorrência / Assinatura ✅ IMPLEMENTADO

**Objetivo**: cliente contrata serviço recorrente ("diarista toda quinta", "jardineiro 1x/mês") com desconto sobre pedido avulso.

### O que foi entregue (2026-06-07)

**Backend**
- ✅ Schema: enums `SubFrequency` (WEEKLY/BIWEEKLY/MONTHLY) + `SubStatus` (ACTIVE/PAUSED/CANCELLED); models `Subscription` e `SubscriptionOccurrence`; `Order.subscription_id` + `Order.subscription_occurrence_id` (unique) para rastreamento
- ✅ Módulo `src/modules/subscriptions/`:
  - `subscriptions.service.ts`:
    - `computeNextOccurrence(freq, current, opts)` — calcula próxima data respeitando weekday/day_of_month/time_slot
    - `generateUpcomingOccurrences(daysAhead=7)` — varre `subscriptions` ACTIVE com `next_occurrence <= now+7d`, gera Order + Proposal aceita + Schedule em transação, avança `next_occurrence`. Falhas viram registro `FAILED` na ocorrência sem travar as outras
  - `subscriptions.controller.ts`:
    - `POST /api/subscriptions` — cria com validação de provider != client + weekday/day_of_month obrigatórios conforme frequência
    - `GET /api/subscriptions?role=client|provider` — lista do cliente OU do prestador
    - `GET /api/subscriptions/:id` — detalhe + últimas 30 ocorrências
    - `PATCH /api/subscriptions/:id` — pausar/retomar/alterar horário; recalcula `next_occurrence` se mudou agenda
    - `DELETE /api/subscriptions/:id` — cancela; ocorrências futuras não são geradas
    - `POST /api/subscriptions/:id/skip-next` — marca próxima como SKIPPED e avança
- ✅ Cron `0 2 * * *` em `server.ts` chama `generateUpcomingOccurrences(7)` diariamente; dependência `node-cron` adicionada
- ✅ Preço efetivo = `base_value * (1 - discount_pct)`, padrão 10% de desconto sobre avulso; aplica taxas de plataforma idênticas ao fluxo normal

**Web (Next.js)**
- ✅ `/assinaturas` — lista com toggle "Como cliente / Como prestador", cards com frequência/dia/horário/preço/próxima ocorrência e ações Pausar/Retomar/Pular próxima/Cancelar
- ✅ Link "Assinaturas" no dropdown do Navbar
- ✅ Cálculo de desconto visível no card

**Mobile (Expo)**
- ✅ Tela `app/(app)/assinaturas.tsx` espelhando o web (toggle cliente/prestador, cards, ações)
- ✅ Link "Assinaturas" em `perfil.tsx`
- ✅ Usa `formatCurrency` manual (sem `Intl`, compatível com Hermes)

### Regras de negócio
- Cliente cria assinatura escolhendo prestador, categoria, frequência, valor base e dia/horário
- Cron diário (02h) gera Order + Schedule já como `ACCEPTED` para próximos 7 dias
- Cliente pode pausar, pular ocorrência específica, ou cancelar — ações refletidas no `next_occurrence`
- Cada ocorrência cria um Order que entra no pipeline normal (pagamento, chat, conclusão, avaliação)
- Ordem pode ser rastreada de volta à assinatura via `Order.subscription_id`

### Endpoint de criação — ✅ wizard entregue (2026-06-07)
- ✅ **Web**: componente `<MakeRecurringButton schedule={...}>` em `src/components/` integrado em `/agendamentos/[id]` quando schedule.status === DONE/RATED (cliente). Modal com frequência/weekday/dia do mês/horário/valor/desconto, pré-preenchido com `order.final_price` e `scheduled_at`. POST `/api/subscriptions` reutilizando provider/category/answers do pedido.
- ✅ **Web standalone**: `/assinaturas/nova` lista todos os agendamentos concluídos do cliente e abre o mesmo modal por item. Botão "+ Nova" no header de `/assinaturas`.
- ✅ **Mobile**: `src/components/MakeRecurringButton.tsx` espelha o web (Modal nativo com chips para frequência/weekday), integrado em `app/(app)/agendamento/[id].tsx`.
- ✅ **Mobile standalone**: `app/(app)/assinatura-nova.tsx` com mesma lista; botão "+ Nova" no header de `assinaturas.tsx`.



### Backend
- **Schema (Prisma):**
  ```prisma
  model Subscription {
    id              String   @id @default(uuid())
    client_id       String
    provider_id     String
    category_id     String
    frequency       Frequency // WEEKLY, BIWEEKLY, MONTHLY, CUSTOM
    weekday         Int?      // 0-6 quando WEEKLY/BIWEEKLY
    day_of_month    Int?      // 1-31 quando MONTHLY
    custom_cron     String?   // expressão para CUSTOM
    time_slot       String    // "08:00"
    base_value      Float     // valor por ocorrência
    discount_pct    Float     @default(0.10) // 10% padrão
    status          SubStatus // ACTIVE, PAUSED, CANCELLED
    next_occurrence DateTime
    payment_method  String    // PIX, CARD
    auto_charge     Boolean   @default(true)
    answers         Json      // respostas congeladas do questionário
    address         String
    latitude        Float?
    longitude       Float?
    created_at      DateTime  @default(now())
    occurrences     SubscriptionOccurrence[]
  }
  model SubscriptionOccurrence {
    id              String   @id @default(uuid())
    subscription_id String
    order_id        String?  @unique // pedido gerado para essa ocorrência
    scheduled_for   DateTime
    status          String   // PENDING, GENERATED, SKIPPED, FAILED
    created_at      DateTime @default(now())
  }
  ```
- **Cron job** (`node-cron`): roda diariamente às 02h gerando `Order` para ocorrências dos próximos 7 dias. Reutiliza pipeline normal (proposta já vinculada → escrow → agendamento).
- **Endpoints:**
  - `POST /api/subscriptions` — criar assinatura
  - `GET /api/subscriptions` — listar (cliente vê suas, prestador vê as dele)
  - `PATCH /api/subscriptions/:id` (pausar/retomar/alterar dia)
  - `DELETE /api/subscriptions/:id` (cancela futuras)
  - `POST /api/subscriptions/:id/skip-next` — pular próxima ocorrência
- **Pagamento**: cartão salvado via Stripe SetupIntent + customer; PIX exige confirmação manual a cada ocorrência (notifica 48h antes).

### Frontend Web
- `/assinaturas` — lista das assinaturas do cliente (ativas/pausadas)
- `/assinaturas/[id]` — detalhe + próximas ocorrências + histórico
- No fluxo de pedido (`/pedido/novo/[categorySlug]`): toggle "Tornar recorrente" → seleciona frequência/dia → exibe desconto
- Em `/perfil` (prestador): aba "Meus contratos recorrentes"

### Mobile
- Tab/seção "Assinaturas" no menu lateral ou em "Meus Pedidos"
- `app/(app)/assinaturas/index.tsx` + `[id].tsx`
- No questionário, toggle de recorrência igual ao web

### Riscos & decisões abertas
- Cancelamento pelo prestador deve permitir período de transição (avisar cliente 30 dias antes)
- Reajuste de preço anual? Definir política antes do lançamento

---

## 2. Pacotes de Serviço ✅ IMPLEMENTADO

**Objetivo**: prestador cria ofertas pré-precificadas que clientes contratam em 1 clique (sem questionário e sem disputa por proposta).

### O que foi entregue (2026-06-07)

**Backend**
- ✅ Schema: novo model `ServicePackage` (provider_id, category_id, title, description, price, duration_min, includes[], photos[], is_active, purchases_count, rating_avg) + `Order.package_id` opcional
- ✅ Migration aplicada via `prisma db push` — coexiste com pedidos via questionário
- ✅ Módulo `src/modules/packages/`:
  - `POST /api/packages` — prestador cria (exige `ProviderSkill` ativa na categoria)
  - `GET /api/packages?category=&lat=&lng=&radius=&min=&max=` — descoberta pública com filtro de raio (haversine) + ordenação por popularidade
  - `GET /api/packages/mine` — pacotes do prestador autenticado (inclui inativos)
  - `GET /api/packages/:id` — detalhe público
  - `GET /api/users/:providerId/packages` — pacotes públicos de um prestador
  - `PATCH /api/packages/:id` — edição (só dono)
  - `DELETE /api/packages/:id` — exclui; se já houve compras, apenas desativa (preserva histórico)
  - `POST /api/packages/:id/purchase` — cria `Order` com `status=ACCEPTED`, pula etapa de propostas (cria `Proposal` fantasma já aceita + `Schedule`), aplica taxas padrão e devolve `client_total` para pagamento

**Web (Next.js)**
- ✅ `/pacotes` — descoberta com busca + filtros de raio (usa geolocation)
- ✅ `/pacotes/[id]` — detalhe + formulário de contratação → redireciona para checkout em `/pagamento/[orderId]`
- ✅ `/perfil/pacotes` — CRUD do prestador com modal de criar/editar
- ✅ Links adicionados ao Navbar: "Pacotes" (todos) + "Meus Pacotes" no dropdown do prestador
- ✅ Tipo `ServicePackage` em `src/types/index.ts`

**Mobile (Expo)**
- ✅ `app/(app)/pacotes/index.tsx` — descoberta com busca
- ✅ `app/(app)/pacotes/[id].tsx` — detalhe + contratação (mesmo fluxo do web)
- ✅ `app/(app)/perfil-pacotes.tsx` — CRUD com Modal nativo (categoria via chip horizontal, sem `Select`)
- ✅ Link "Meus Pacotes" em `perfil.tsx` para prestadores
- ✅ Tipo `ServicePackage` em `src/types/index.ts`

### Fluxo de contratação
1. Cliente abre pacote → preenche cidade/UF/endereço → confirma
2. Backend cria Order/Proposal aceita/Schedule em transação atômica + incrementa `purchases_count`
3. Cliente é redirecionado ao checkout (PIX/cartão) usando o mesmo pipeline de Orders
4. Após pagamento, agendamento entra no fluxo normal (chat, check-in, conclusão, avaliação)

### Decisões
- Pacotes exigem `ProviderSkill` ativa na categoria — garante que prestador foi calibrado
- Exclusão é "soft" se houve compras — preserva histórico e avaliações
- `final_price = price` (sem dynamic pricing) — preço travado pelo prestador no momento da publicação



### Backend
- **Schema:**
  ```prisma
  model ServicePackage {
    id              String   @id @default(uuid())
    provider_id     String
    category_id     String
    title           String   // "Limpeza pesada apto 2 quartos"
    description     String
    price           Float
    duration_min    Int      // duração estimada em minutos
    includes        String[] // bullets: "Inclui produtos", "Limpeza de janelas"
    photos          String[]
    is_active       Boolean  @default(true)
    purchases_count Int      @default(0)
    rating_avg      Float    @default(0)
    created_at      DateTime @default(now())
  }
  ```
- **Endpoints:**
  - `POST /api/packages` (prestador cria)
  - `GET /api/packages?category=&lat=&lng=&radius=` (descoberta)
  - `GET /api/users/:providerId/packages`
  - `POST /api/packages/:id/purchase` — cria Order já com `final_price`, status SCHEDULED após pagamento; pula etapa de propostas
- **Order** ganha campo `package_id String?`.

### Frontend Web
- `/perfil` (prestador): aba "Meus Pacotes" → CRUD com upload de fotos
- `/pacotes` — descoberta (filtros por categoria/raio/preço)
- `/pacotes/[id]` — detalhe + botão "Contratar agora" → fluxo de pagamento direto

### Mobile
- `app/(app)/pacotes/index.tsx` + `[id].tsx`
- CRUD em `app/(app)/perfil/pacotes/index.tsx` + `editar/[id].tsx`
- Card destacado no Home: "Pacotes perto de você"

---

## 3. Agenda Pública (Calendly-style) ✅ IMPLEMENTADO

**Objetivo**: prestador define horários disponíveis. Cliente vê e agenda direto, sem trocar proposta.

### O que foi entregue (2026-06-07)

**Backend**
- ✅ Schema: models `AvailabilityRule` (provider_id, weekday, start_time, end_time, slot_min, category_id?) e `AvailabilityException` (date único por prestador, blocked, override start/end, note)
- ✅ Módulo `src/modules/availability/`:
  - `GET /api/users/me/availability` — devolve regras + exceções futuras do prestador autenticado
  - `PUT /api/users/me/availability` — bulk replace de regras (delete + createMany em transação) com validação `start_time < end_time`
  - `POST /api/users/me/availability/exception` — upsert de exceção (chave `provider_id + date`)
  - `DELETE /api/users/me/availability/exception/:id`
  - `GET /api/users/:providerId/availability?from=&to=&category=` — **público**, calcula slots livres entre `from` e `to`:
    - Aplica regras do weekday (filtradas por categoria se informada)
    - Sobrescreve com exceção (bloqueia dia inteiro OU substitui janela)
    - Remove slots já ocupados por `Schedule` CONFIRMED/IN_PROGRESS
    - Devolve `{ days: [{ date, slots: ["08:00", "09:00", ...] }] }`
  - `POST /api/orders/direct-book` — cliente reserva slot direto: valida conflito de horário, cria Order ACCEPTED + Proposal auto-aceita + Schedule em transação, devolve `client_total` para checkout

**Web (Next.js)**
- ✅ `/perfil/agenda` (prestador): cadastro de regras semanais (weekday/start/end/slot) + exceções (dias bloqueados com observação)
- ✅ `/p/agendar/[providerId]` — página pública de agendamento: lista próximos 14 dias com slots, cliente seleciona categoria + título + cidade + valor combinado → redireciona para checkout em `/pagamento/[orderId]`
- ✅ Link "Minha agenda" no dropdown do Navbar (prestadores)

**Mobile (Expo)**
- ✅ `app/(app)/agenda-config.tsx` — config de regras e exceções espelhando o web (chips horizontais para weekday)
- ✅ Link "Minha agenda" em `perfil.tsx` para prestadores

### Cálculo de slots
- Para cada dia entre `from` e `to`:
  - Se há exceção bloqueada sem horário → dia inteiro fora
  - Se há exceção com `start_time`/`end_time` → usa só essa janela
  - Senão usa regras do weekday do dia
- Para cada janela, gera slots de `slot_min` minutos
- Remove slots cujo timestamp ISO já tem Schedule confirmado
- Retorna apenas dias com slots disponíveis

### Decisões
- `category_id` na regra é opcional (null = vale para todas as categorias da skill do prestador)
- Conflito de horário no `direct-book` retorna 400 ("Horário não está mais disponível")
- Slots são UTC — front é responsável por converter para timezone local na exibição



### Backend
- **Schema:**
  ```prisma
  model AvailabilityRule {
    id          String  @id @default(uuid())
    provider_id String
    weekday     Int     // 0-6
    start_time  String  // "08:00"
    end_time    String  // "17:00"
    slot_min    Int     @default(60) // duração de cada slot
    category_id String? // null = todas
  }
  model AvailabilityException {
    id          String   @id @default(uuid())
    provider_id String
    date        DateTime // dia específico bloqueado/extra
    blocked     Boolean
    start_time  String?
    end_time    String?
  }
  ```
- **Endpoints:**
  - `GET /api/users/:providerId/availability?from=&to=` — devolve slots livres calculados (regras − exceções − agendamentos confirmados)
  - `PUT /api/users/me/availability` — bulk upsert de regras
  - `POST /api/users/me/availability/exception`
  - `POST /api/orders/direct-book` — cliente reserva slot direto (cria Order + Proposal auto-aceita + Schedule)

### Frontend Web
- `/perfil/agenda` (prestador) — grid semanal editável + exceções
- `/p/[providerSlug]` — perfil público + calendário (mês/semana) + slots clicáveis
- Compartilhar link "Agendar comigo" → gera URL pública

### Mobile
- `app/(app)/perfil/agenda.tsx` — config
- `app/(app)/prestador/[id].tsx` — visualização do calendário (lib `react-native-calendars`)

### Dependências
- Lib: `dayjs` (já presumido) + `react-native-calendars` no mobile
- Validação de conflito com `Schedule` existente

---

## 4. Programa de Indicação com Crédito ✅ IMPLEMENTADO

**Objetivo**: cada usuário ganha código único; indicado ganha R$ X no 1º pedido, indicador ganha R$ Y após indicado completar.

### O que foi entregue (2026-06-07)

**Backend**
- ✅ Schema: `User.referral_code (unique)`, `User.referred_by_id`, `User.credit_balance Float @default(0)`
- ✅ Novo enum `ReferralStatus` (PENDING/COMPLETED/EXPIRED) + models `ReferralEvent` e `CreditTransaction`
- ✅ `Order.credit_applied Float @default(0)` para auditoria de crédito usado em cada pedido
- ✅ Módulo `src/modules/referrals/`:
  - `referrals.service.ts`:
    - `generateReferralCode(name)` — `NOME` + 4 chars aleatórios (ex: `ALMIZBWX`)
    - `ensureReferralCode(userId)` — gera código se ainda não tiver, com retry contra colisão
    - `applyReferralOnRegister(newUserId, code, ip)` — cria evento PENDING + dá R$ 20 ao indicado (anti-fraude: bloqueia auto-indicação e mesmo CPF)
    - `maybeCompleteReferral(userId, orderId)` — chamado em rating → credita R$ 30 ao indicador
    - `consumeCredit(userId, amount, ref)` — debita até o limite e loga em `CreditTransaction`
  - `referrals.controller.ts`:
    - `GET /api/referrals/my-code` — código + saldo + stats + 20 últimos eventos + share_url + deep_link
    - `GET /api/referrals/events` — histórico completo
    - `GET /api/referrals/credits` — extrato de transações de crédito
    - `GET /api/referrals/lookup/:code` — **público**, devolve nome+avatar do dono (para landing)
- ✅ Integração:
  - `auth.controller.register` aceita `referral_code` opcional → aplica via `applyReferralOnRegister`
  - `auth.controller.register` chama `ensureReferralCode` para todo novo usuário
  - `ratings.controller.rateSchedule` chama `maybeCompleteReferral` quando ambos avaliaram
  - `payments.controller.createCheckout` aceita `use_credit: boolean` → debita via `consumeCredit`, abate `client_total`, salva `Order.credit_applied`

**Web (Next.js)**
- ✅ Tela `/indicar` — saldo, estatísticas, código + share, botão "Copiar link" e "Compartilhar" (Web Share API), histórico com avatar/nome/status
- ✅ Página pública `/convite/[code]` — landing com avatar do convidador, mostrando recompensa de R$ 20, com CTAs Cliente/Prestador (servidor faz `fetch` para `/referrals/lookup`)
- ✅ Campo "Código de indicação (opcional)" em `/register` (pré-preenchido se vier de `?codigo=` ou `?ref=`)
- ✅ Tipo `User.referral_code` / `credit_balance` adicionado

**Mobile (Expo)**
- ✅ Tela `app/(app)/indicar.tsx` espelhando o web, com `Share.share()` nativo + fallback de Clipboard
- ✅ Campo "Código de indicação" no `(auth)/register.tsx` (pré-preenchido a partir do AsyncStorage `@mc:pending-referral`)
- ✅ Deep link handler em `app/_layout.tsx`: `missaocumprida://convite/CODE` → guarda código + redireciona pro register
- ✅ Tipo `User.referral_code` / `credit_balance` adicionado

### Regras de negócio
- Indicado recebe R$ 20 imediatamente no registro (saldo `credit_balance`)
- Indicador recebe R$ 30 quando o indicado **completa** o 1º serviço (status `RATED`)
- Anti-fraude: bloqueia auto-indicação e mesmo CPF entre indicador e indicado
- Idempotência: cada usuário só pode ser indicado uma vez (`@unique` em `referred_id`)
- Crédito pode ser aplicado em qualquer pedido (`use_credit: true` no checkout) — debita até o `client_total`

### Como funciona o link
- Web: `https://app/convite/CODE`
- Mobile (deep link): `missaocumprida://convite/CODE`
- Ambos preenchem o código de indicação no registro automaticamente

### Backend
- **Schema:**
  ```prisma
  model User { // adicionar
    referral_code     String  @unique // ex: "JOAO4F2"
    referred_by_id    String?
    credit_balance    Float   @default(0)
  }
  model ReferralEvent {
    id              String   @id @default(uuid())
    referrer_id     String
    referred_id     String
    status          String   // PENDING, COMPLETED, EXPIRED
    referrer_reward Float    // ex: 30.00
    referred_reward Float    // ex: 20.00
    triggered_order_id String?
    created_at      DateTime @default(now())
    completed_at    DateTime?
  }
  model CreditTransaction {
    id        String   @id @default(uuid())
    user_id   String
    amount    Float    // positivo = crédito, negativo = uso
    reason    String   // REFERRAL_EARNED, ORDER_DISCOUNT, ADJUSTMENT
    ref_id    String?  // orderId ou referralEventId
    created_at DateTime @default(now())
  }
  ```
- **Regras:**
  - Crédito do indicado é aplicado automaticamente no 1º pedido (até o limite do crédito)
  - Indicador só ganha quando indicado **completa** primeiro pedido (status RATED)
  - Crédito expira em 90 dias (cron limpa)
  - Anti-fraude: bloquear se mesmo CPF, IP, dispositivo
- **Endpoints:**
  - `GET /api/referrals/my-code` — código + estatísticas
  - `GET /api/referrals/events` — histórico
  - `POST /api/auth/register` — aceita `referral_code` no body
  - No `POST /api/payments/create-checkout`: aplica `credit_balance` se solicitado

### Frontend Web
- `/indicar` — código + botão "Compartilhar" (WhatsApp, link) + histórico + saldo
- Campo "Código de indicação" opcional no registro
- Badge no pagamento: "Você tem R$ X em crédito — usar?"

### Mobile
- `app/(app)/indicar.tsx` com `expo-sharing` para WhatsApp/Instagram
- Deep link `missaocumprida://convite/JOAO4F2` → preenche código no registro

---

## 5. Modo Urgência ✅ IMPLEMENTADO

**Objetivo**: cliente paga taxa extra para encontrar prestador em até 2h. Push para todos os prestadores no raio.

### O que foi entregue (2026-06-07)

**Backend**
- ✅ `Order` ganhou campos `is_urgent`, `urgency_fee_pct`, `urgency_fee_value`, `urgency_deadline`, `urgency_radius_km`, `urgency_expanded_at`
- ✅ `orders.controller.createOrder` aceita `is_urgent: boolean` + `urgency_radius_km` opcional:
  - Aplica acréscimo de 25% sobre `estimated_price_min/max` (`URGENCY_FEE_PCT = 0.25`)
  - Define `urgency_deadline = now + 2h`
  - Raio padrão: 10km (configurável até 50km via body)
  - Filtra `ProviderSkill` ativas + `haversineDistance <= raio` (quando há coordenadas) para mass push
  - Envia push no canal `urgent_orders` (separado de `general` — mobile pode customizar som)
  - Título prefixado com 🚨 URGENTE
- ✅ `orders.controller.getFeed` ordena por `[{ is_urgent: 'desc' }, { created_at: 'desc' }]` — urgentes sempre primeiro

**Web (Next.js)**
- ✅ Toggle "🚨 Preciso urgente" em `/pedido/novo/[categorySlug]` com card vermelho destacado mostrando "+25% no valor" quando ativo
- ✅ Cards urgentes em `/feed` ganham `border-2 border-rose-500 bg-rose-50/50` + badge "🚨 URGENTE" + horário do deadline
- ✅ Tipos `Order.is_urgent`, `urgency_deadline`, etc. adicionados

**Mobile (Expo)**
- ✅ Toggle urgência em `pedido/novo/[slug].tsx` espelho do web
- ✅ Cards urgentes em `feed.tsx` com border vermelha + badge "🚨 URGENTE"
- ✅ Tipos espelhados em `src/types/index.ts`

### Regras
- Acréscimo: 25% sobre faixa estimada — visível no toggle ao cliente antes de enviar
- Push é enviado apenas para prestadores com habilidade ativa na categoria E dentro do raio (quando há GPS)
- Canal `urgent_orders` no push permite som/prioridade diferenciada no mobile
- Deadline 2h — UI mostra horário limite no feed; expiração automática (cancel + reembolso) será adicionada como cron futura

### SLA e split (✅ entregues 2026-06-07)
- ✅ **Cron de SLA** (`*/5 * * * *`): `src/modules/urgency/urgency.service.ts` → `runUrgencySla()`:
  - Para cada pedido `is_urgent` em `OPEN/IN_PROPOSAL`, se `urgency_deadline` expirou: cancela, rejeita propostas pendentes, devolve crédito aplicado ao `credit_balance` (com `CreditTransaction.reason='ADJUSTMENT'`) e notifica o cliente.
  - Se faz ≥30min desde a última expansão e raio atual < 50km: expande +5km, atualiza `urgency_expanded_at`, e envia push só para os prestadores na nova faixa anelar (delta de cobertura), evitando spam dos já notificados.
- ✅ **Split 50/50** em `acceptProposal` (`proposals.controller.ts`): quando `order.is_urgent`, calcula `urgency_total = proposal.value × 25%`, soma ao `client_total`, divide metade para `provider_amount` (bônus) e metade para `platform_fee_value`. `Order.urgency_fee_value` é gravado com o total para auditoria.
- ✅ **Canal `urgent_orders` no mobile** (`mobile/src/lib/notifications.ts`): canal Android dedicado com `importance: MAX`, vibração agressiva `[0,500,250,500,250,500]`, `bypassDnd: true`, light vermelho. Push do backend já usa `channel: 'urgent_orders'`.



### Backend
- **Schema (extensão de Order):**
  ```prisma
  model Order {
    is_urgent           Boolean  @default(false)
    urgency_fee_pct     Float?   // ex: 0.25 = 25% sobre valor estimado
    urgency_deadline    DateTime? // quando expira
    urgency_radius_km   Int?     @default(10)
  }
  ```
- **Endpoints:**
  - `POST /api/orders` aceita `is_urgent: true` → adiciona surcharge ao preço estimado, ativa fluxo
  - Job que ao criar pedido urgente: busca prestadores ativos no raio com skill na categoria + push em massa "🚨 Pedido urgente perto de você"
  - SLA: se ninguém aceita em 30min → expande raio em 5km; se 2h sem proposta → cancela com reembolso automático
- **Distribuição da taxa**: 50% para o prestador (incentivo) + 50% para plataforma

### Frontend Web
- Toggle "🚨 Preciso urgente (chegada em até 2h)" no questionário — exibe acréscimo claro
- Card destacado no `/feed` com timer regressivo + ordenação no topo
- Banner em `/meus-pedidos` com contagem regressiva

### Mobile
- Mesmo toggle no questionário
- Notification channel separado: `urgent_orders` com som alto (Android)
- Card em `feed.tsx` com borda animada/pulsante

### Riscos
- Geolocalização obrigatória para prestador receber push urgente
- Cuidado com fadiga de notificação: limite de N urgências/dia por prestador

---

## 6. Boost de Proposta ✅ IMPLEMENTADO

**Objetivo**: prestador paga para destacar sua proposta no topo da lista do cliente.

### O que foi entregue (2026-06-07)

**Backend**
- ✅ `Proposal` ganhou `boost_level` (0/1/2), `boost_paid_at`, `boost_value`
- ✅ Novo model `BoostPurchase` (provider_id, proposal_id, level, value, payment_ref) para auditoria
- ✅ `proposals.controller.boostProposal` em `POST /api/proposals/:id/boost`:
  - Valida ownership (dono da proposta) + status PENDING
  - Tabela de preços: nível 1 (R$ 5 — Destaque amarelo) / nível 2 (R$ 15 — Topo + Recomendado)
  - Debita do `provider_balance` em transação atômica
  - Cria `BoostPurchase` com `payment_ref='INTERNAL_BALANCE'`
  - Bloqueia downgrade ou repetição do mesmo nível
- ✅ `listOrderProposals` ordena por `[{ boost_level: 'desc' }, { created_at: 'asc' }]` — boost sempre no topo
- ✅ Todas as propostas continuam visíveis (transparência ética)

**Web (Next.js)**
- ✅ Componente `<BoostProposalButton>` em `src/components/` — Modal com 2 níveis, chamada à API, feedback
- ✅ Integrado em `/minhas-propostas`: botão "Destacar" em propostas PENDING + badge mostrando nível atual
- ✅ Em `/pedido/[id]` (visão cliente): cards de propostas ganham borda colorida + badge "⭐ Destaque" (amarelo) ou "🚀 Recomendado" (verde) discreto

**Mobile (Expo)**
- ✅ Nova tela `app/(app)/minhas-propostas.tsx` com lista + Modal nativo de boost (2 opções)
- ✅ StatCell "Propostas" no home redireciona para a tela
- ✅ Em `pedido/[id]`: badges nos cards de propostas espelhando o web

### Tabela de preços
| Nível | Selo | Preço | Efeito |
|-------|------|-------|--------|
| 1 | ⭐ Destaque | R$ 5 | Borda/fundo amarelo na proposta |
| 2 | 🚀 Recomendado | R$ 15 | Borda verde + selo "Recomendado" + vai para o topo |

### Ética / transparência
- Todas as propostas (boost ou não) continuam visíveis para o cliente — boost só altera ordem e destaque visual
- Cliente vê o selo sem mensagem do tipo "patrocinado" (UI sutil) — transparência via Termos de Uso
- Boost só é cobrado se a proposta ainda está PENDING (proposta aceita/recusada não pode ser destacada)
- Pagamento descontado do saldo interno do prestador (não cobra cartão a cada boost)



### Backend
- **Schema:**
  ```prisma
  model Proposal {
    boost_level   Int      @default(0) // 0=normal, 1=destaque, 2=topo
    boost_paid_at DateTime?
    boost_value   Float?
  }
  model BoostPurchase {
    id           String   @id @default(uuid())
    provider_id  String
    proposal_id  String
    level        Int
    value        Float    // 5.00, 10.00, 15.00
    payment_id   String   // referência ao Payment
    created_at   DateTime @default(now())
  }
  ```
- **Endpoints:**
  - `POST /api/proposals/:id/boost` body: `{ level: 1|2 }` → debita do `provider_balance` ou cobra cartão
  - Listagem de propostas ordena por `boost_level DESC, created_at ASC`
- **Tabela de preços (sugerida):**
  - Nível 1 (destaque amarelo): R$ 5
  - Nível 2 (topo + selo "Recomendado"): R$ 15

### Frontend Web
- Em `/pedido/[id]/proposals` (visão prestador): botão "Destacar minha proposta" após enviar
- Visão do cliente: badges visuais sutis ("⭐ Destacado") sem mostrar que é pago

### Mobile
- Espelho exato do web em `app/(app)/pedido/[id].tsx`

### Considerações éticas/legais
- Sempre exibir TODAS as propostas (nunca esconder não pagas)
- Marcar boost discretamente para cliente; transparência via Termos

---

## 7. Selo "Profissional Verificado" ✅ IMPLEMENTADO

**Objetivo**: assinatura mensal (R$ 29,90) que verifica antecedentes + dá selo + boost nos resultados.

### O que foi entregue (2026-06-07)

**Backend**
- ✅ Schema: `User.is_verified_pro`, `verified_pro_since`, `verified_pro_expires`, `verification_data Json?` (separados do KYC `document_verified` já existente)
- ✅ Novo model `VerifiedProSubscription` com enum `VerifiedProStatus` (ACTIVE/PAST_DUE/CANCELLED), `current_period_end`, `monthly_value` (R$ 29,90 default), `stripe_sub_id` opcional
- ✅ Módulo `src/modules/verification/`:
  - `POST /api/verification/start` — coleta `full_name`, `document_number`, `background_check_consent`, fotos opcionais → grava em `verification_data` JSON
  - `POST /api/verification/subscribe` — cria `VerifiedProSubscription` ACTIVE com `current_period_end = now + 1 mês` e ativa selo no usuário (`is_verified_pro = true`); bloqueia duplicação
  - `POST /api/verification/cancel` — marca CANCELLED + remove selo
  - `GET /api/verification/me` — devolve status + assinatura ativa + monthly_value
  - `POST /api/verification/admin/:userId/approve` e `.../reject` — gates manuais para ADMIN
- ✅ Stripe Subscription intencionalmente deferido (campo `stripe_sub_id` aceita opcional) — integração webhook fica pronta para próxima iteração

**Web (Next.js)**
- ✅ `/verificar` — landing com 4 benefícios em grid (Selo, Boost grátis nível 1, 1.3x busca, Antecedentes) + wizard de 3 passos (landing → form → subscribe) → ativa em 1 clique
- ✅ Estado pós-ativação: card emerald com "Você é Verificado Pro ✓" + data de expiração + botão Cancelar
- ✅ Componente `<VerifiedBadge>` reutilizável (tamanhos xs/sm/md, com/sem label)
- ✅ Selo ao lado do nome do prestador em `/pedido/[id]` (proposta)
- ✅ Link "Verificado Pro" no dropdown do Navbar (prestadores) com chip "R$ 29,90" quando ainda não é pro

**Mobile (Expo)**
- ✅ Tela `app/(app)/verificar-pro.tsx` espelhando o web com mesmo wizard
- ✅ Link em `perfil.tsx` (prestadores): card com borda azul quando é pro, ou CTA "Tornar-se Verificado Pro" quando não é
- ✅ Tipo `User.is_verified_pro` adicionado

### Benefícios técnicos (✅ entregues 2026-06-07)
- ✅ **Boost gratuito de nível 1 automático**: na criação de proposta (`POST /api/orders/:orderId/proposals`), se `provider.is_verified_pro=true`, a proposta já nasce com `boost_level=1` e `boost_value=0`. O endpoint `POST /api/proposals/:id/boost` também não cobra nível 1 para Pro (registra `BoostPurchase` com `payment_ref='VERIFIED_PRO_FREE'`).
- ✅ **Selo visível no card de proposta** (já existia)
- ✅ **Posição na busca multiplicada por 1.3x**:
  - `listOrderProposals` ordena por `[boost_level desc, provider.is_verified_pro desc, created_at asc]`
  - `listPackages` ordena por `[provider.is_verified_pro desc, purchases_count desc, rating_avg desc]` + score `purchases_count × 1.3` para Pro
- ✅ **Filtro "Apenas verificados"**:
  - `GET /api/packages?verified_only=1` — UI chip em `/pacotes` (web) e `pacotes/index.tsx` (mobile)
  - `GET /api/orders/:orderId/proposals?verified_only=1` — UI chip no header das propostas em `/pedido/[id]` (web)
- ✅ Badge `<VerifiedBadge>` exibido ao lado do nome do prestador em cards de pacote (web + mobile)

### Decisões
- KYC (`document_verified`) e Verified Pro (`is_verified_pro`) são fluxos independentes — um prestador pode ter KYC sem ser Pro, e vice-versa em tese
- `verification_data` é JSON flexível para incluir consentimento, dados de doc, status de checagem futura
- Ativação imediata após `/subscribe` (sem aguardar webhook); admin pode revogar com `/admin/:userId/reject`



### Backend
- **Schema:**
  ```prisma
  model User {
    is_verified_pro       Boolean  @default(false)
    verified_pro_since    DateTime?
    verified_pro_expires  DateTime?
    verification_data     Json?    // doc, antecedentes, etc
  }
  model VerifiedProSubscription {
    id              String   @id @default(uuid())
    user_id         String
    stripe_sub_id   String   @unique
    status          String   // ACTIVE, PAST_DUE, CANCELLED
    current_period_end DateTime
    monthly_value   Float    @default(29.90)
    created_at      DateTime @default(now())
  }
  ```
- **Endpoints:**
  - `POST /api/verification/start` — coleta doc/selfie (S3/R2 privado)
  - `POST /api/verification/subscribe` — cria Stripe Subscription mensal
  - `POST /api/payments/stripe-webhook` — trata `customer.subscription.*`
  - Admin: `POST /api/verification/:userId/approve|reject`
- **Benefícios técnicos:**
  - `feed` filtra opção "Apenas verificados"
  - Boost gratuito de nível 1 em todas as propostas
  - Posição na busca multiplicada por 1.3x

### Frontend Web
- `/verificar` — landing explicando benefícios + checkout
- `/perfil/verificacao` — fluxo de envio de documentos
- Selo ✅ azul no perfil público + cards do feed

### Mobile
- `app/(app)/verificar.tsx` com `expo-camera` para selfie + foto do RG
- Selo replicado em todos os locais que exibem nome/avatar

---

## 8. Cross-sell ✅ IMPLEMENTADO

**Objetivo**: após serviço concluído (ex: pintura), sugerir serviços complementares (limpeza pós-obra).

### O que foi entregue (2026-06-07)

**Backend**
- ✅ Schema: model `CategoryAffinity` (source_category, target_category, score, label, delay_days) com `@@unique([source, target])` para idempotência
- ✅ Script `prisma/seed-affinities.ts` com 20 afinidades editorialmente curadas (Pintor → Limpeza pós-obra 0.95, Mudanças → Diarista 0.85, Eletricista → Automação 0.5, etc.) — comando `npm run db:seed:affinities`
- ✅ Módulo `src/modules/recommendations/`:
  - `GET /api/recommendations/after-order/:orderId` — devolve top 3 categorias de afinidade + top 3 prestadores próximos para cada (ordenados por distância, depois rating)
  - Resultado inclui `label`, `delay_days`, `category`, `providers` (com flag `is_verified_pro`)
  - Validação: só o cliente do pedido pode consultar

**Web (Next.js)**
- ✅ Componente `<CrossSellSuggestions orderId={...}>` em `src/components/`
  - Card com gradiente brand→violet, ícone Sparkles, header "Que tal contratar também?"
  - Lista até 3 sugestões clicáveis → cada link leva para `/pedido/novo/[slug]` da categoria sugerida
  - Mostra ícone, nome, label da afinidade, contagem de prestadores próximos
  - Selo Verificado discreto se há prestadores Pro próximos
- ✅ Integrado em `/agendamentos/[id]` (topo): aparece quando `status === DONE` ou `order.status === RATED` para o cliente

**Mobile (Expo)**
- ✅ Componente `src/components/CrossSellSuggestions.tsx` espelho do web
- ✅ Integrado em `agendamento/[id].tsx` (logo após resumo do agendamento)

### Lista de afinidades seedadas (20)
| Origem | Destino | Score | Quando |
|--------|---------|-------|--------|
| pintor | limpeza-pos-obra | 0.95 | imediato |
| pedreiro | limpeza-pos-obra | 0.95 | imediato |
| pedreiro | eletricista | 0.7 | em 3 dias |
| pedreiro | encanador | 0.7 | em 3 dias |
| mudancas-e-carretos | diarista | 0.85 | em 2 dias |
| mudancas-e-carretos | montador-de-moveis | 0.95 | imediato |
| corte-de-grama | jardinagem | 0.8 | em 30 dias |
| corte-de-grama | dedetizador | 0.4 | em 60 dias |
| eletricista | automacao-residencial | 0.5 | em 30 dias |
| eletricista | cabeamento-e-redes | 0.6 | em 14 dias |
| buffet-completo | djs | 0.7 | imediato |
| buffet-completo | decoracao | 0.7 | imediato |
| buffet-completo | garcons-e-copeiras | 0.85 | imediato |
| diarista | passadeira | 0.6 | em 21 dias |
| jardinagem | corte-de-grama | 0.8 | em 30 dias |
| encanador | pedreiro | 0.4 | em 14 dias |
| pintor | gesso-e-drywall | 0.5 | em 7 dias |
| marceneiro | pintor | 0.5 | em 14 dias |
| montador-de-moveis | diarista | 0.6 | em 1 dia |
| dedetizador | limpeza-pos-obra | 0.4 | em 1 dia |

### Decisões
- Sugestões são exibidas via componente embed na tela do agendamento (sem nova tela dedicada)
- `delay_days` está no payload mas ainda não filtra exibição — futura cron pode disparar push "Já pensou em [X]?" após o delay
- Sem teste A/B (futuro) — atualmente sempre mostra top 3 ordenado por score

### Cron de cross-sell (✅ entregue 2026-06-07)
- ✅ `src/modules/recommendations/crossSellPush.service.ts` com `runCrossSellPushSweep()`:
  - Varre `Schedule.status=DONE` dos últimos 60 dias
  - Para cada um, busca top 3 `CategoryAffinity` da categoria de origem
  - Dispara push (canal `cross_sell`) somente quando `now >= done_at + delay_days`
  - Idempotência via `Notification.data.cross_sell_key = "<schedule_id>:<target_slug>"` — não envia duplicado
  - Limite de 1 push por agendamento por execução para evitar spam (próxima ocorrência fica para o próximo dia)
- ✅ Cron `0 10 * * *` em `server.ts` chama o sweep diariamente às 10h
- 🔜 A/B test de ordem (score puro vs score × disponibilidade × distância) — deferido

### Outras triggers de push (✅ entregues 2026-06-07)
- ✅ **Pagamento liberado**: em `confirmByClient` (schedules), quando `payment.status=PAID`, dispara push canal `payment` ao prestador com valor creditado
- ✅ **Avaliação recebida**: em `rateSchedule` (ratings), notifica o avaliado com estrelas + preview do comentário (canal `general`)



### Backend
- **Schema:**
  ```prisma
  model CategoryAffinity {
    id              String  @id @default(uuid())
    source_category String
    target_category String
    score           Float   // 0..1, peso da relação
    label           String  // "Após pintura, considere..."
  }
  ```
- **Seed** com mapeamentos editorialmente curados (ver Anexo A):
  - Pintura → Limpeza Pós-Obra (0.9), Marceneiro (0.4)
  - Mudança → Diarista (0.85), Montagem de Móveis (0.95)
  - Reforma → Limpeza Pós-Obra (0.95), Eletricista (0.6), Encanador (0.6)
  - Corte de grama → Jardinagem (0.8), Dedetização (0.4)
- **Endpoint:**
  - `GET /api/recommendations/after-order/:orderId` — devolve top 3 categorias + prestadores próximos com bom rating
- Triggers: após status `RATED`, criar notificação "Já pensou em [X]?"

### Frontend Web
- Tela de avaliação concluída → card "Que tal contratar também?"
- Email/push 3 dias depois

### Mobile
- Mesmo card no fim do fluxo de avaliação
- Push notification scheduling local via `expo-notifications`

---

## 9. Notificações Push Reais (FCM/APNs) ✅ IMPLEMENTADO

**Objetivo**: substituir o stub atual por push real cross-platform.

### O que foi entregue (2026-06-07)

**Backend**
- ✅ Migration `add_push_tokens_and_onboarding` aplicada
- ✅ Model `PushToken` com enum `PushPlatform` (EXPO/FCM/APNS/WEB)
- ✅ `User.notification_preferences Json` para canais
- ✅ Módulo `src/modules/push/`:
  - `push.service.ts` — `sendToUser`, `sendToUsers`, `notify` com:
    - Envio via `expo-server-sdk` para tokens EXPO (com chunking + cleanup de DeviceNotRegistered)
    - Envio via `web-push` para tokens WEB (cleanup automático em 404/410)
    - Respeito a `notification_preferences[channel]`
  - `push.controller.ts` — register/unregister/preferences/test
  - Rotas `POST /api/push/register`, `DELETE /api/push/token/:token`, `PUT /api/push/preferences`, `POST /api/push/test`
- ✅ Triggers existentes migrados para enviar push real:
  - `orders.controller.ts` — novo pedido na área (sendToUsers)
  - `proposals.controller.ts` — nova proposta + aceite (canal `new_proposal`, `proposal_update`)
  - `schedules.controller.ts` — check-in / conclusão / confirmação (`schedule_update`)
  - `messages.controller.ts` — nova mensagem no chat (`chat_message`, preview truncado)
- ✅ `.env.example` ganhou `EXPO_ACCESS_TOKEN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

**Mobile (Expo)**
- ✅ `src/lib/notifications.ts` ganhou:
  - `registerPushTokenWithBackend()` — pega Expo Push Token (com projectId), envia para API e cacheia
  - `unregisterPushToken()` — chamado no logout
  - `attachNotificationListeners()` — handlers para receive (foreground) e response (tap → navegar)
- ✅ `app/_layout.tsx` registra token quando autenticado + anexa listeners (router.push em order_id/schedule_id)
- ✅ `src/store/auth.ts` chama `unregisterPushToken()` no logout
- ✅ Tela `app/(app)/notificacoes-config.tsx` — toggles por canal + botão de teste
- ✅ Tipo `User.notification_preferences` e `User.onboarding_state` adicionados

**Web (Next.js)**
- ✅ `public/sw.js` — Service Worker com push + notificationclick (foco/abrir em /pedido/[id] ou /agendamentos/[id])
- ✅ `src/lib/push.ts`:
  - `isPushSupported()`, `registerServiceWorker()`, `requestPushPermission()`
  - `subscribeAndRegisterWithBackend()` — converte VAPID base64 em Uint8Array e registra
  - `unsubscribePush()`
- ✅ `(app)/layout.tsx` tenta registrar push silenciosamente quando o user carrega
- ✅ Tela `/perfil/notificacoes` — switch ativação + toggles por canal + teste
- ✅ `.env.local.example` ganhou `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

### Como ativar push em produção
1. **Backend**: gerar chaves VAPID com `npx web-push generate-vapid-keys` e popular `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`.
2. **Frontend**: copiar `VAPID_PUBLIC_KEY` para `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
3. **Mobile**: configurar `projectId` em `app.json` (`extra.eas.projectId`) — necessário para Expo Push fora de Expo Go.
4. Em desenvolvimento, sem essas chaves, push web fica em no-op silencioso; mobile depende de development build (não funciona em Expo Go por limitação do SDK 53+).

### Triggers de push integradas (✅ entregues 2026-06-07)
- ✅ Pagamento liberado para prestador (após confirmação do cliente) — canal `payment`, em `schedules.controller.confirmByClient`
- ✅ Avaliação recebida — canal `general`, em `ratings.controller.rateSchedule` (notifica o avaliado com estrelas + preview)
- ✅ Push de cross-sell respeitando `delay_days` — cron diário às 10h via `runCrossSellPushSweep()` em `modules/recommendations/crossSellPush.service.ts`

---

## 10. Chat em Tempo Real (Socket.io) ✅ IMPLEMENTADO

**Objetivo**: substituir polling de 5s do chat por Socket.io.

### O que foi entregue (2026-06-07)

**Backend**
- ✅ Dependência `socket.io` instalada
- ✅ `src/server.ts` agora usa `createServer(app)` + `initRealtime(httpServer)`
- ✅ Módulo `src/modules/realtime/`:
  - Handshake autenticado via JWT (token vem em `socket.handshake.auth.token`)
  - Rooms: `schedule:<id>` (chat de agendamento) + `user:<id>` (eventos pessoais)
  - Validação de permissão: só client/provider do agendamento podem entrar no room
  - Eventos `chat:message:send`, `chat:typing`, `chat:read`, `chat:message:new`
  - Persistência via Prisma + fallback de push notification para o destinatário offline
- ✅ `messages.controller.ts` emite `chat:message:new` no room também via REST (para clientes em modo fallback)

**Web (Next.js)**
- ✅ Dependência `socket.io-client` instalada
- ✅ Hook `src/hooks/useChatSocket.ts` com:
  - Conexão automática ao montar / desconexão ao desmontar
  - `sendMessage(content)` retorna promise (com timeout 10s) → cai para REST se falhar
  - `setTyping(boolean)` debounced no servidor
  - `markRead()` atualiza `read_at` em batch
  - Flag `NEXT_PUBLIC_USE_SOCKET=false` permite desligar (rollout gradual)
- ✅ Integrado em `agendamentos/[id]/page.tsx`:
  - Polling reduzido de 5s para 15s (só busca dados do schedule, não chat)
  - Indicador "digitando..." e badge "Conectado em tempo real"
  - Send via socket com fallback REST automático

**Mobile (Expo)**
- ✅ Dependência `socket.io-client` instalada (com `--legacy-peer-deps`)
- ✅ Hook `src/hooks/useChatSocket.ts` espelhando o web (token do AsyncStorage)
- ✅ Integrado em `app/(app)/agendamento/[id].tsx`:
  - Polling reduzido para 15s como fallback
  - Indicador "digitando..." + badge de conexão
  - Send via socket com fallback REST

### Configuração
- Backend: nenhuma env extra — usa o mesmo `JWT_ACCESS_SECRET`
- Web: `NEXT_PUBLIC_API_URL` é reusado para WebSocket (mesma URL); `NEXT_PUBLIC_USE_SOCKET=false` para desativar
- Mobile: `EXPO_PUBLIC_API_URL` reusado

### Coexistência REST + Socket
- Endpoint REST `GET /schedules/:id/messages` continua disponível para histórico inicial
- `POST /schedules/:id/messages` continua disponível como fallback quando socket está desconectado
- Mensagens são deduplicadas por `id` no client antes de inserir no estado

### Triggers ainda a integrar (futuras)
- Adapter Redis para escalar horizontalmente (`@socket.io/redis-adapter`)
- Reconexão automática em mudança de network no mobile (Expo NetInfo)
- Compartilhar a conexão entre telas (atualmente cada `/agendamento/[id]` abre uma)



### Backend
- Dependências: `socket.io` + adaptador Redis (para scale horizontal futuro)
- **Setup:** `server.ts` instancia `io = new Server(httpServer)` autenticado via JWT no handshake
- **Rooms:**
  - `schedule:<scheduleId>` — chat de um agendamento
  - `user:<userId>` — eventos pessoais (proposta, push fallback)
- **Eventos:**
  - `message:send` (client → server) → persiste em `Message` → emit `message:new` na room
  - `typing:start` / `typing:stop`
  - `message:read` → atualiza `read_at`
  - `presence` (online/offline) em `user:<id>:status`
- Manter endpoints REST como fallback para histórico inicial

### Frontend Web
- Lib: `socket.io-client`
- Hook `useChatSocket(scheduleId)` em `agendamentos/[id]/page.tsx`
- Indicador "digitando..." + tick de leitura

### Mobile
- Mesmo `socket.io-client`
- Reconexão automática em mudança de network (Expo NetInfo)
- Cuidado com background: socket desconecta → fallback para push

### Migração
- Polling continua coexistindo por 2 semanas; flag `USE_SOCKET=true` no client
- Métricas de latência antes/depois

---

## 11. Onboarding Guiado ✅ IMPLEMENTADO

**Objetivo**: reduzir abandono. Fluxo passo-a-passo para Prestador e para Cliente.

### O que foi entregue (2026-06-07)

**Backend**
- ✅ `User.onboarding_state Json @default("{}")` (mesma migration `add_push_tokens_and_onboarding`)
- ✅ Endpoint `PUT /api/users/me/onboarding` aceita `{ flow: 'provider'|'client', step, completed, data }` e faz merge no estado
- ✅ `getMe` retorna `onboarding_state` + `notification_preferences`

**Web (Next.js)**
- ✅ Route group `(onboarding)/` sem navbar — layout próprio com gradient
- ✅ `/comecar` — escolha entre fluxos (prestador / cliente / ambos se BOTH)
- ✅ `/comecar/cliente` — 3 passos: tour → localização (geolocation API) → conclusão (redirect /home)
- ✅ `/comecar/prestador` — 6 passos: intro → perfil → localização → habilidades → CPF → chave PIX (redirect /feed)
- ✅ Progress bar topo + botão "Pular por enquanto" em todos os passos
- ✅ `(app)/layout.tsx` redireciona automaticamente para `/comecar/<flow>` se `onboarding_state[flow].completed !== true`

**Mobile (Expo)**
- ✅ Route group `(onboarding)/` com `_layout.tsx` (Stack sem header)
- ✅ `(onboarding)/comecar-cliente.tsx` — 3 passos com lazy require de `expo-location`
- ✅ `(onboarding)/comecar-prestador.tsx` — 6 passos com picker custom (sem `Select`) para categorias agrupadas e tipo de chave PIX
- ✅ `app/(app)/_layout.tsx` redireciona se onboarding incompleto
- ✅ Root `_layout.tsx` registra a screen `(onboarding)`

### Fluxos por perfil
- **Cliente (3 passos)**: tour de 3 cartões → localização opcional → conclusão
- **Prestador (6 passos)**: intro → perfil (nome/telefone/bio) → localização → habilidade (categoria + anos + raio) → CPF → chave PIX

### Decisões de UX
- Por simplicidade e tracking, cada passo persiste estado no backend a cada `Continuar`
- Botão "Pular por enquanto" permite chegar ao app mesmo sem completar (mas `(app)/layout.tsx` continua redirecionando até completed=true)
- BOTH role: prestador tem prioridade sobre cliente no redirect (poderá completar cliente depois manualmente)

---

## 12. Dashboard Analítico do Prestador ✅ IMPLEMENTADO

**Objetivo**: visão clara de funil + ganhos.

### O que foi entregue (2026-06-07)

**Backend**
- ✅ Módulo `src/modules/analytics/` (sem nova migration — agregação direta dos models existentes)
- ✅ Cache em memória com TTL de 5 min (por usuário + período) — substituível por Redis sem alterar o controller
- ✅ Endpoints (todos protegidos por `requireRole('PROVIDER', 'BOTH', 'ADMIN')`):
  - `GET /api/analytics/provider/overview?period=30d` — KPIs: `proposals_sent`, `proposals_accepted`, `proposals_rejected`, `conversion_rate`, `services_done`, `services_in_progress`, `total_earnings`, `platform_fees_paid`, `avg_ticket`, `paid_orders_count`, `released_orders_count`, `rating_avg`, `rating_count`, `provider_balance`
  - `GET /api/analytics/provider/earnings-timeseries?period=12m&granularity=month|day` — série completa com **buckets vazios preenchidos** (gráfico contínuo)
  - `GET /api/analytics/provider/categories?period=30d` — performance por categoria (icon, sent, accepted, conversion_rate, total_value) ordenado por valor total
  - `GET /api/analytics/provider/recent?limit=10` — últimos agendamentos com cliente + categoria
- ✅ Períodos aceitos: `7d`, `30d`, `90d`, `12m` (parsing flexível com regex `(\d+)[dm]`)

**Web (Next.js)**
- ✅ Página `/dashboard` (route group `(app)`) com:
  - **PeriodSelector** (segmented control 7d/30d/90d/12m) — recarrega tudo ao trocar
  - **8 KPIs** em grid 2×4 (responsivo): Ganhos, Saldo, Conversão, Avaliação, Concluídos, Ticket médio, Propostas enviadas, Taxas pagas
  - **Gráfico de área** com Recharts (gradient brand-700) + tooltip formatado em BRL + grid e eixos
  - **Tabela de Por categoria** (top 8 ordenado por valor) — icon, nome, conversão, valor total
  - **Tabela de Últimos agendamentos** — última atividade real do prestador
- ✅ Link **Dashboard** adicionado ao Navbar para `PROVIDER/BOTH/ADMIN`
- ✅ Lib: `recharts` (instalada)

**Mobile (Expo)**
- ✅ Tela `app/(app)/dashboard.tsx`:
  - PeriodTabs com 7d/30d/90d/12m
  - 8 cards de KPIs em grid 2 colunas
  - **Gráfico de barras nativo** (View + flex, sem lib pesada) — auto-escala pelo máximo, até 30 barras, mostra label de início/fim e valor máximo
  - Lista de Por categoria
- ✅ Link **Dashboard** no `/perfil` (apenas se `isProvider`), ícone violeta

### Métricas computadas
- **conversion_rate** = `proposals_accepted / proposals_sent` no período
- **total_earnings** = soma de `Payment.provider_amount` com status `RELEASED` e `released_at` no período
- **avg_ticket** = média do `provider_amount` dos pagamentos `PAID`+`RELEASED` no período
- **platform_fees_paid** = soma de `Payment.platform_fee` (pagamentos liberados)
- **services_done / in_progress** = contagem direta de `Schedule.status`

### Performance
- Cache TTL 5 min por chave `kind:userId:period` evita recomputar a cada navegação
- Para >10k pagamentos, migrar para queries agregadas (GROUP BY no DB)
- Sem polling — recarrega só quando muda período

---

## 13. Compartilhamento de Pedido (link público) ✅ IMPLEMENTADO

**Objetivo**: cliente compartilha pedido em redes sociais; visitantes podem visualizar e se cadastrar como prestador para responder.

### O que foi entregue (2026-06-07)

**Backend**
- ✅ Schema: `Order.public_share_slug String? @unique`, `public_share_enabled Boolean @default(false)`, `public_view_count Int @default(0)`
- ✅ Módulo `src/modules/public-share/`:
  - `makeSlug(title)` — slug normalizado (sem acentos/special chars) + sufixo random
  - `POST /api/orders/:id/share` (auth) — gera slug se ainda não houver, liga `public_share_enabled`, devolve `{ slug, url, deep_link }`
  - `DELETE /api/orders/:id/share` (auth) — desliga compartilhamento
  - `GET /api/public/orders/:slug` (sem auth) — devolve dados públicos com **mascaramento**:
    - Mostra: título, descrição, fotos, categoria, bairro/cidade/UF, data desejada, faixa estimada, contagem de propostas, primeiro nome + rating do cliente
    - Oculta: endereço completo, telefone, e-mail
  - Validação: só `OPEN`/`IN_PROPOSAL` podem ser visualizados; incrementa `public_view_count` em cada acesso

**Web (Next.js)**
- ✅ Página pública `/p/pedido/[slug]/page.tsx` (server component) com:
  - `generateMetadata` populando Open Graph (preview em WhatsApp/Twitter com 1ª foto)
  - Header com título + categoria + bairro/cidade + contagem de propostas
  - Estimativa em destaque
  - Galeria de fotos
  - CTA "Quero fazer uma proposta" → `/register?tipo=prestador`
- ✅ Componente `<ShareOrderButton>` (client component) em `src/components/`:
  - Botão "Compartilhar" injetado no header de `/pedido/[id]` (só para o cliente em OPEN/IN_PROPOSAL)
  - Modal com URL gerada + botão copiar + Web Share API + opção "Desativar link"

**Mobile (Expo)**
- ✅ Botão de compartilhar (ícone Share2) no header de `app/(app)/pedido/[id].tsx`
- ✅ Usa `Share.share({ message, url })` nativo do React Native
- ✅ Deep link `missaocumprida://pedido/SLUG` registrado em `app/_layout.tsx` → navega para `/pedido/SLUG` se autenticado

### Segurança / privacidade
- Slug é único e gerado aleatoriamente — não permite enumeração
- Endereço completo nunca é exposto na rota pública
- Cliente pode desativar compartilhamento a qualquer momento (mantém slug histórico para invalidar caches)
- View count rastreado para métricas de viralização

### Backend
- **Schema:**
  ```prisma
  model Order {
    public_share_slug String? @unique // "ajuda-com-mudanca-9f3a"
    public_share_enabled Boolean @default(false)
    public_view_count Int @default(0)
  }
  ```
- **Endpoints:**
  - `POST /api/orders/:id/share` — gera slug
  - `GET /api/public/orders/:slug` — devolve dados públicos (sem dados sensíveis: endereço aproximado/bairro, sem telefone)
- **Segurança:** somente OPEN/IN_PROPOSAL podem ser compartilhados; expira após aceite

### Frontend Web
- `/p/pedido/[slug]` — landing pública (sem auth) + CTA "Fazer proposta — cadastre-se grátis"
- Botão "Compartilhar" em `/pedido/[id]` com Web Share API + cópia de link
- Open Graph tags (`<meta og:*>`) para preview em WhatsApp/Facebook

### Mobile
- `expo-sharing` + `expo-linking` para deep links `missaocumprida://pedido/slug`
- Mesma landing pública via `WebBrowser.openBrowserAsync` ou route pública

---

## 14. Expansão de Categorias (replicar GetNinjas) ✅ IMPLEMENTADO (fase 1)

**Objetivo**: ir de 25+ categorias para 400+ cobrindo 10 grupos como GetNinjas.

### O que foi entregue (2026-06-07)

**Backend**
- ✅ `prisma/seed-archetypes.ts` — 9 arquétipos com fields padronizados (REPAIR, AREA_CLEANING, AREA_SERVICE, TRANSPORT, LESSON, EVENT, HEALTH_BEAUTY, CONSULTING, GENERIC)
- ✅ `prisma/seed-expansion.ts` — script idempotente (upsert por slug) que:
  - Cria 10 grupos novos com prefixo PT-BR (`reformas-reparos`, `assistencia-tecnica`, etc.)
  - Cria **248 categorias** distribuídas pelos 10 grupos
  - Replica os fields de cada arquétipo (1023 campos novos no total)
  - Aplica `pricing_formula` específico em 13 categorias top (calibradas) e arquétipo genérico nas demais
- ✅ Comando `npm run db:seed:expansion` no `package.json`
- ✅ Coexiste com o seed.ts original — nenhuma categoria existente é alterada/removida
- ✅ Schema da `Category` ganhou `archetype`, `pricing_formula`, `pricing_unit`, `region_multiplier`

**Resumo da expansão por grupo**
| Grupo | Categorias |
|-------|-----------:|
| Reformas e Reparos | 49 |
| Assistência Técnica | 25 |
| Aulas Particulares | 34 |
| Serviços Domésticos e Pets | 20 |
| Moda e Beleza | 16 |
| Eventos | 27 |
| Automóveis | 13 |
| Saúde | 18 |
| Consultoria | 23 |
| Design e Tecnologia | 23 |
| **Total** | **248** |

**Web / Mobile**
- ✅ A listagem `/home` (já existente) automaticamente exibe os novos grupos via `GET /api/categories/groups` — nenhum código de UI precisou mudar
- ✅ Endpoint `GET /api/categories/:slug/questionnaire` agora devolve `archetype`, `pricing_formula`, `pricing_unit` e cada field traz `key` + `pricing_effect`

### Estratégia adotada
- **Não migrar tudo manualmente** — script `prisma/seed-expansion.ts` parametrizável
- Categorias com questionários padronizados por arquétipo (ver Anexo B)
- Rollout em fases:
  - **Fase 1** (concluída): 248 categorias em 10 grupos
  - **Fase 2** (futura): variações regionais + categorias longtail

### Arquétipos de questionário (reusáveis)
Os 9 arquétipos cobrem 90% das categorias:

| Arquétipo | Categorias-exemplo | Perguntas base |
|-----------|-------------------|----------------|
| **Reparo Residencial** | Eletricista, Encanador, Chaveiro | tipo de problema, urgência, fornece material? |
| **Limpeza Área** | Diarista, Limpeza pós-obra, Janela | m² ou cômodos, tipo de imóvel, materiais inclusos? |
| **Serviço por Área** | Pintura, Corte de Grama, Jardinagem | m², estado atual, materiais? |
| **Transporte/Mudança** | Mudanças, Carretos, Frete | origem, destino, volume, andar, elevador? |
| **Aula** | Idiomas, Música, Esportes | nível atual, frequência semanal, modalidade (online/presencial) |
| **Evento** | Buffet, DJ, Decoração | nº convidados, data, tipo de evento, duração |
| **Saúde/Estética** | Fisio, Manicure, Personal | onde (domicílio/local), frequência, tipo |
| **Técnico/Consultoria** | Advogado, Contador, Design | tipo de demanda, prazo, online/presencial |

### Lista mestra de categorias por grupo (extraída do GetNinjas)

**1. Reformas e Reparos (71)**: Acessibilidade, Afiação, Agrimensura, Aluguel de Equipamentos, Aluguel de Maquinário, Antenista, Análises Ambientais, Arquiteto, Automação Residencial, Banheira, Casas e Chalés de Madeira, Chaveiro, Climatização, Coifas e Exaustores, Concretagem, Decorador, Dedetizador, Demolição, Desentupidor, Design de Interiores, Desinfecção, Dutos, Eletricista, Empreiteiro, Encanador, Energia Solar, Engenheiro, Escada e Corrimão, Escavação, Fossa, Galvanização, Gesso e DryWall, Gás, Impermeabilizador, Instalador TV Digital, Instalação de Eletrônicos, Instalação de Papel de Parede, Isolamento Térmico/Acústico, Jardinagem, Lareira, Lazer e Recreação, Limpeza de Vidros, Limpeza Pós-Obra, Marceneiro, Marido de Aluguel, Marmoraria, Montador de Móveis, Mudanças e Carretos, Paisagista, Pavimentação, Pedreiro, Pintor, Piscina, Portão Automático, Poço Artesiano, Prevenção de Incêndio, Reciclagem, Redes de Proteção, Remoção de Entulho, Restauração de Pisos, Sauna, Segurança Eletrônica, Segurança Perimetral, Serralheria e Solda, Sonorização, Tapeceiro, Terraplanagem, Toldos e Coberturas, Topografia, Vidraceiro.

**2. Assistência Técnica (34)**: Adega Climatizada, Aparelho de Som, Aparelhos de Ginástica, Aquecedor a Gás, Ar Condicionado, Cabeamento e Redes, Celular, Computador, Cortador de Grama, Câmera, DVD/Blu-Ray, Eletrodomésticos, Fogão e Cooktop, Fone de Ouvido, Geladeira e Freezer, Gerador, Home Theater, Impressora, Instrumentos Musicais, Lava Louça, Lava Roupa, Micro-ondas, Máquina de Costura, Notebooks, Relógios, Secadora, Smartwatch, Tablet, Telefone, PABX, Televisão, Venda de Aparelhos Quebrados, Venda de Usados, Vídeo Game.

**3. Aulas (~30)**: Escolares, Ensino Superior, Profissionalizante, Pré-Vestibular, Concursos, Tarefas, Idiomas (Inglês, Espanhol, Francês, Alemão, Italiano, Mandarim, Japonês, Coreano, etc.), Artes, Artesanato, Fotografia, Moda, TV/Teatro, Música (Canto, Violão, Piano, Bateria, Violino, Guitarra), Circo, Dança, Esportes (Personal Trainer, Yoga, Pilates, Natação, Tênis, Futebol), Lutas (Boxe, Jiu-Jitsu, Muay Thai, Karatê), Bem-Estar, Web Development, Informática, Marketing Digital, Esports, Saúde, Beleza, Esoterismo, Gastronomia, Paisagismo, Direção, Lazer, Jogos, Educação Especial.

**4. Serviços Domésticos e Pets (~25)**: Diarista, Passadeira, Cozinheira, Babá, Cuidador de Idosos, Motorista Particular, Personal Organizer, Personal Shopper, Acompanhante, Lavanderia, Costureira, Passeador de Cães (Dog Walker), Adestrador, Banho e Tosa, Hospedagem Pet, Veterinário Domiciliar, Pet Sitter, Limpeza de Estofados, Limpeza de Carpetes, Limpeza de Caixa d'Água, Limpeza de Piscina, Síndico Profissional, Faxineira, Empregada Doméstica, Cuidador Pet.

**5. Moda e Beleza (20)**: Alfaiate, Artesanato, Barbeiro, Bronzeamento, Cabeleireiros, Corte e Costura, Depilação, Designer de Cílios, Designer de Sobrancelhas, Esotérico, Esteticista, Manicure e Pedicure, Maquiadores, Micropigmentador, Ourives, Personal Stylist, Podólogo, Sapateiro, Visagista, Outros.

**6. Eventos (29)**: Animação de Festas, Assessor de Eventos, Bandas e Cantores, Bartenders, Brindes, Buffet Completo, Carros de Casamento, Casting, Celebrantes, Chocolateiro, Churrasqueiro, Confeitaria, Decoração, DJs, Equipamentos para Festas, Florista, Food Truck, Fotografia, Garçons e Copeiras, Gravação de Vídeos, Local para Eventos, Manobrista, Organização de Eventos, Personal Chef, Recepcionistas, Segurança, Sommelier, Ônibus Balada.

**7. Automóveis (14)**: Alarme, Ar Condicionado Automotivo, Auto Elétrico, Borracharia, Funilaria, Guincho, Higienização e Polimento, Insulfilm, Martelinho de Ouro, Mecânica Geral, Pintura, Som Automotivo, Venda de Automóveis, Vidraçaria Automotiva.

**8. Saúde (18)**: Aconselhamento Conjugal, Biomedicina Estética, Coach, Cuidador de Pessoas, Dentista, Doula, Enfermeira, Fisioterapeuta, Fonoaudiólogo, Hipnoterapia, Médico, Nutricionista, Psicanalista, Psicólogo, Quiropraxia, Remoção de Tatuagem, Terapia Ocupacional, Terapias Alternativas.

**9. Consultoria (28)**: Adm. de Condomínios, Adm. de Imóveis, Advogado, Assessor de Investimentos, Assessoria de Imprensa, Auditoria, Auxílio Administrativo, Consultor Pessoal, Consultoria Especializada, Contador, Corretor, Despachante, Detetive Particular, Digitação, Economia e Finanças, Escrita e Conteúdo, Guia de Turismo, Mediação de Conflitos, Palestrantes, Pesquisas, Produção de Conteúdo, Recrutamento, Segurança do Trabalho, Testamento, Tradução, Tradução Juramentada, Treinamentos, Outros.

**10. Design e Tecnologia (25)**: Animação, Aplicativos, Autocad e Modelagem 3D, Automação Comercial, Conversão de Formatos, Convites, Corte a Laser, Criação de Logos, Criação de Marca, Desenvolvimento de Games, Desenvolvimento de Sites, Diagramador, Edição de Fotos, Ilustração, Marketing Online, Materiais Promocionais, Panfletagem, Produção Gráfica, Restauração de Fotos, Serviços de TI, Streaming, UX/UI Design, Web Design, Áudio e Vídeo, Outros.

**Total entregue: 248 categorias diretas. Fase 2 (longtail + variações regionais) ainda pendente.**

---

## 15. Precificação Dinâmica por Questionário ✅ IMPLEMENTADO

**Objetivo**: substituir faixa fixa por cálculo real baseado nas respostas.

### O que foi entregue (2026-06-07)

**Backend**
- ✅ Migration `add_dynamic_pricing` aplicada — `Category` ganhou `archetype`, `pricing_formula`, `pricing_unit`, `region_multiplier`; `QuestionnaireField` ganhou `key` e `pricing_effect`
- ✅ `utils/priceEstimator.ts` reescrito com `estimatePriceDynamic`:
  - Suporta 4 métodos: PER_UNIT, HOURLY, FIXED, TIERED
  - Resolve respostas por `key` estável OU por `id`
  - Aplica: MULTIPLIER, SURCHARGE (FIXED/PERCENT), EXTRA_PER_UNIT, UNIT_QUANTITY
  - Multiplicador regional embutido (SP 1.4, RJ 1.3, …) com possibilidade de override por categoria
  - Garante `min_charge` (chamada mínima)
  - Devolve `{ min, max, unit, breakdown[] }` com explicação por etapa
  - Fallback para algoritmo legado quando `pricing_formula` é null (zero breaking change)
- ✅ Novo endpoint `POST /api/categories/:slug/estimate` body `{ answers, state? }` → preview em tempo real
- ✅ `GET /api/categories/:slug/questionnaire` agora retorna `pricing_formula`, `pricing_unit`, `archetype` + `pricing_effect`/`key` em cada field
- ✅ `orders.controller.ts` usa `estimatePriceDynamic` na criação (estimativa armazenada em `Order.estimated_price_min/max`)

**Web (Next.js)**
- ✅ Componente `<PriceEstimator>` em `src/components/PriceEstimator.tsx` com:
  - Debounce 400ms
  - Loading inline
  - Breakdown de etapas (ex: "60 × m²: R$ 18–25/m², estado_atual ×1.20, Região SP ×1.40")
  - Callback `onEstimate(min, max)` para preencher `Order.estimated_price_min/max` no submit
- ✅ Integrado em `(app)/pedido/novo/[categorySlug]/page.tsx`

**Mobile (Expo)**
- ✅ `src/components/PriceEstimator.tsx` espelhando o web (NativeWind, sem Intl)
- ✅ Integrado em `(app)/pedido/novo/[slug].tsx` substituindo o cálculo manual antigo

### Calibragem das 10 categorias top
| Categoria | Fórmula | Resultado teste |
|-----------|---------|-----------------|
| Corte de Grama | PER_UNIT m², R$ 1,5–5/m², min 80 | 50m² ótimo → R$ 80–250 · 200m² ruim SP → **R$ 630–2100** |
| Pintura | PER_UNIT m², R$ 18–25/m², min 250 | 60m² médio → **R$ 1.296–1.800** |
| Diarista | HOURLY R$ 25–50/h, min 150 | 6h regular → R$ 150–300 · 10h pesada SP → **R$ 490–980** |
| Eletricista | TIERED (visita/reparo/instalação/urgente) | visita FIXED R$ 80–150; instalação 5 pontos → R$ 225–650 |
| Encanador | REPAIR (TIERED) | mesmo padrão eletricista |
| Pedreiro | FIXED R$ 200–1500 | ajustado por dificuldade |
| Marceneiro | FIXED R$ 150–800 | |
| Mudanças | TRANSPORT FIXED | bau_3_4 + sem elevador → +20% |
| Limpeza Pós-Obra | HOURLY R$ 40–75/h, min 300 | |
| Jardinagem | PER_UNIT m², R$ 2–6/m² | |

### Estruturas

**`pricing_formula` (Category):**
```json
{
  "method": "PER_UNIT",            // PER_UNIT | FIXED | HOURLY | TIERED
  "unit_field": "area_m2",
  "base_rate_min": 18,
  "base_rate_max": 25,
  "min_charge": 250,
  "pricing_unit": "m²",
  "tiers": [ /* só para TIERED */ ]
}
```

**`pricing_effect` (QuestionnaireField):**
```json
{ "type": "MULTIPLIER", "options": { "boa": 1.0, "media": 1.2, "ruim": 1.5 } }
{ "type": "UNIT_QUANTITY" }
{ "type": "SURCHARGE", "if_true": { "kind": "FIXED", "amount": 50 } }
{ "type": "SURCHARGE", "if_false": { "kind": "PERCENT", "pct": 0.20 } }
{ "type": "EXTRA_PER_UNIT", "amount_min": 8, "amount_max": 12 }
```

### Migração de dados
- Migration adiciona campos novos, NÃO remove `base_price_min/max` (mantida como fallback)
- Seed de expansão popula `pricing_formula` por arquétipo em todas as 248 categorias novas
- Categorias antigas (sem pricing_formula) continuam funcionando via algoritmo legado

---

## 16. Roadmap Sugerido

**Trilha A — Quick wins (4 semanas) — 🎉 CONCLUÍDA**
- ✅ Sem 1: #9 Push real + #11 Onboarding — **concluído 2026-06-07**
- ✅ Sem 2: #14 Expansão categorias (fase 1) + #15 Precificação dinâmica — **concluído 2026-06-07**
- ✅ Sem 3: #4 Indicação + #13 Link público — **concluído 2026-06-07**
- ✅ Sem 4: #12 Dashboard prestador — **concluído 2026-06-07**

**Trilha B — Features principais (8 semanas) — 🎉 CONCLUÍDA**
- ✅ Sem 5-6: #10 Socket.io (chat) + #2 Pacotes — **concluído 2026-06-07**
- ✅ Sem 7-8: #3 Agenda pública + #1 Recorrência — **concluído 2026-06-07**
- ✅ Sem 9-10: #5 Modo Urgência + #6 Boost — **concluído 2026-06-07**
- ✅ Sem 11-12: #7 Selo Verificado + #8 Cross-sell — **concluído 2026-06-07**

**Trilha C — Polimento contínuo**
- Expansão categorias fase 2 + 3
- Calibração de preços por feedback real
- A/B testing em onboarding

---

## 17. Polimentos Pós-Implantação (✅ entregues 2026-06-07)

Conjunto de 6 melhorias rodadas em sequência sobre o produto já lançado.

### Pós-1. Home: Acordeon de grupos + "Voltar a contratar"

**Web** (`frontend/src/app/(app)/home/page.tsx`) e **Mobile** (`mobile/app/(app)/home.tsx`):
- ✅ Categorias agora vêm colapsadas por grupo. Clica no header do grupo → expande os tiles de categoria.
- ✅ Estado de quais grupos estão abertos persiste em `localStorage` (web `mc:home-open-groups`) / `AsyncStorage` (mobile `@mc:home-open-groups`).
- ✅ Busca ignora o acordeon: digita "limpeza" e a tela já lista categorias diretas.
- ✅ Quando há serviços já contratados, aparece a row **"Voltar a contratar"** com top 3 prestadores recentes. Link leva para `/pedido/novo/<slug>?provider=<id>` com o prestador pré-vinculado.

**Backend**: `GET /api/recommendations/recent-providers` em `modules/recommendations/recommendations.controller.ts`.

### Pós-2. Limpeza de erros de Badge

Pré-existiam ~16 erros TS de `Badge variant="success|default|info|warning|danger"` enquanto o tipo `BadgeVariant` define `blue|green|amber|red|gray|purple|fuchsia`. Substituídos em:
- `(app)/carteira/page.tsx` (mapeamento `withdrawalStatusColor`)
- `(app)/pedido/[id]/page.tsx` (badge de status de proposta)
- `(app)/perfil/page.tsx` (selo "✓ Verificado")
- `design-system/page.tsx` (showcase de variantes + cards)

Resultado: `tsc --noEmit` no frontend agora retorna **0 erros**.

### Pós-3. Memo dos tiles de categoria

- Web: `<CategoryTile>` envolvido em `React.memo` — abrir/fechar grupo de 49 categorias (Reformas) não re-renderiza os tiles dos outros grupos.
- Mobile: `<CategoryGrid>` também em `memo`.

### Pós-4. Persistência do acordeon

Implementado junto com Pós-1 (mesma feature). Ver acima.

### Pós-5. Lock de cron para multi-instância

`backend/src/utils/cronLock.ts` expõe `withCronLock(name, fn)` usando **Postgres advisory locks** (`pg_try_advisory_lock`). Aplicado nos 3 crons:
- `subscriptions-occurrences` (02h)
- `urgency-sla` (cada 5min)
- `cross-sell-push` (10h)

Permite escalar horizontalmente sem duplicar trabalho — instância que não conseguir o lock só loga e segue. Sem necessidade de Redis ou nova tabela.

### Pós-6. Destaque grátis para pacotes novos de Verified Pro

`listPackages` em `packages.controller.ts` agora:
- Marca pacotes de Pro publicados nos últimos **7 dias** com `is_pro_highlighted: true`
- Aplica boost no score: `purchases_count × 1.3 (Pro) × 1.5 (Highlighted)` + `rating_avg × 0.5` + `2 (Highlighted)`
- Tipo `ServicePackage.is_pro_highlighted` adicionado em web + mobile
- **Web**: card ganha borda azul + ring + faixa "⭐ Destaque Pro · Novo" no topo
- **Mobile**: mesma faixa azul no topo do card

Garante que prestadores novos Pro tenham visibilidade na primeira semana sem precisar pagar boost.

### Testes pós-implantação
- ✅ Backend: `tsc --noEmit` → 0 erros
- ✅ Frontend: `tsc --noEmit` → 0 erros (após limpeza de Badge)
- ✅ Mobile: `tsc --noEmit` → 0 erros

---

## Anexos

### Anexo A — Mapeamento de afinidades (cross-sell, valores iniciais)
| Origem | Destino | Score | Quando sugerir |
|--------|---------|-------|----------------|
| Pintor | Limpeza Pós-Obra | 0.95 | Imediato |
| Pedreiro | Limpeza Pós-Obra | 0.95 | Imediato |
| Pedreiro | Eletricista | 0.7 | Em 3 dias |
| Pedreiro | Encanador | 0.7 | Em 3 dias |
| Mudanças | Diarista | 0.85 | 2 dias após mudança |
| Mudanças | Montador de Móveis | 0.95 | Imediato |
| Corte de Grama | Jardinagem | 0.8 | 30 dias |
| Corte de Grama | Dedetização | 0.4 | 60 dias |
| Eletricista | Automação Residencial | 0.5 | 30 dias |
| Festa (Buffet) | DJ | 0.7 | Imediato |
| Festa (Buffet) | Decoração | 0.7 | Imediato |
| Festa (Buffet) | Garçom | 0.85 | Imediato |
| Diarista | Passadeira | 0.6 | Após 3 contratações |

### Anexo B — Templates de questionário por arquétipo
Tabela com perguntas base de cada arquétipo (descrita acima na seção 14). Implementar como objetos TypeScript em `prisma/seed-archetypes.ts` para reutilização.

### Anexo C — Fontes de pesquisa para precificação

**GetNinjas (categorias):**
- [Blog GetNinjas — Quais serviços oferece](https://blog.getninjas.com.br/quais-servicos-o-getninjas-oferece/)
- [GetNinjas — Reformas e Reparos](https://www.getninjas.com.br/reformas-e-reparos)
- [GetNinjas — Assistência Técnica](https://www.getninjas.com.br/assistencia-tecnica)
- [GetNinjas — Aulas](https://www.getninjas.com.br/aulas)
- [GetNinjas — Moda e Beleza](https://www.getninjas.com.br/moda-e-beleza)
- [GetNinjas — Eventos](https://www.getninjas.com.br/eventos)
- [GetNinjas — Saúde](https://www.getninjas.com.br/saude)
- [GetNinjas — Automóveis](https://www.getninjas.com.br/automoveis)
- [GetNinjas — Consultoria](https://www.getninjas.com.br/consultoria)
- [GetNinjas — Design e Tecnologia](https://www.getninjas.com.br/design-e-tecnologia)

**Precificação (referências usadas):**
- Corte de grama: [Trice Brasil](https://www.tricebrasil.com.br/blog/preco-para-cortar-grama-em-2026-veja-quanto-cobrar-ou-pagar-pelo-servico), [Cronoshare](https://www.cronoshare.com.br/quanto-custa/cortar-grama)
- Pintura: [Trice Brasil — pintor m²](https://www.tricebrasil.com.br/blog/preco-da-mao-de-obra-de-pintor-em-2026-quanto-custa-o-m2-tabela-atualizada), [TáContratado](https://tacontratado.com.br/quais-os-valores-cobrados-por-um-pintor/)
- Diarista: [Trice Brasil — faxina](https://www.tricebrasil.com.br/blog/preco-de-faxina-completa-em-2026-veja-quanto-esta-sendo-cobrado-e-como-contratar-diarista-com-seguranca), [Odete](https://odete.com.br/blog/quanto-cobrar-diarista), [TáContratado](https://tacontratado.com.br/faxineira-por-dia-preco-2026/)
- Eletricista: [Engehall](https://engehall.com.br/tabela-preco-eletricista-2025/), [Trice Brasil](https://www.tricebrasil.com.br/blog/preco-da-mao-de-obra-de-eletricista-em-2026), [Prummo](https://prummo.app/pt-BR/guias/quanto-custa-um-eletricista-brasil), [Reforma & Construa](https://www.reformeconstrua.com.br/blog/preco-instalacao-eletrica-m2)
- Construção civil geral: [Planilhas de Obra](https://www.planilhasdeobra.com/tabela-de-preco-da-construcao-civil-metro-quadrado/), [Lar Pontual](https://larpontual.com.br/portal/custo-de-reforma-por-m2)

### Anexo D — Bibliotecas/serviços a contratar
| Categoria | Web | Mobile | Backend |
|-----------|-----|--------|---------|
| Push | `web-push` + Service Worker | `expo-notifications` | `expo-server-sdk` |
| Realtime | `socket.io-client` | `socket.io-client` | `socket.io` + adapter Redis |
| Charts | `recharts` | `react-native-gifted-charts` | — |
| Stripe Subscriptions | Stripe.js | Stripe RN SDK | Stripe Node |
| Cron | — | — | `node-cron` ou BullMQ |
| Cache analytics | — | — | `ioredis` |

---

*Fim do documento — atualizar a cada feature concluída marcando ✅ no roadmap.*
