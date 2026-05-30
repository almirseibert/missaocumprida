# Missão Cumprida — Documentação do Projeto

> Marketplace de serviços locais (estilo TaskRabbit/Fiverr) para o mercado brasileiro.
> Atualizado automaticamente a cada etapa concluída.

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Backend (API) | Node.js + Express |
| ORM | Prisma |
| Banco de Dados | PostgreSQL |
| Autenticação | JWT + Refresh Token |
| Upload de Arquivos | Multer + armazenamento local (dev) / Cloudflare R2 (prod) |
| Cache / Filas | Redis (fase 2) |
| Pagamentos | Stripe (fase 2) |
| Tempo Real | Socket.io (fase 2) |
| Frontend | Next.js 14 (App Router) + TailwindCSS |
| Estado global | Zustand |
| Formulários | React Hook Form + Zod |
| Mobile | React Native + Expo (fase 3) |

---

## Estrutura de Pastas (Backend)

```
missaocumprida/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Schema completo do banco
│   │   ├── migrations/            # Histórico de migrations
│   │   └── seed.ts                # Dados iniciais (categorias, serviços)
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts        # Conexão Prisma
│   │   │   └── env.ts             # Variáveis de ambiente
│   │   ├── middlewares/
│   │   │   ├── auth.ts            # Verificação JWT
│   │   │   ├── upload.ts          # Multer config
│   │   │   └── errorHandler.ts    # Tratamento global de erros
│   │   ├── modules/
│   │   │   ├── auth/              # Login, registro, refresh token
│   │   │   ├── users/             # Perfis de usuário
│   │   │   ├── categories/        # Categorias e grupos de serviço
│   │   │   ├── questionnaires/    # Questionários dinâmicos por serviço
│   │   │   ├── orders/            # Pedidos de serviço
│   │   │   ├── proposals/         # Propostas dos prestadores
│   │   │   ├── schedules/         # Agendamentos
│   │   │   ├── ratings/           # Avaliações duplas
│   │   │   ├── messages/          # Chat
│   │   │   └── uploads/           # Upload de fotos
│   │   ├── utils/
│   │   │   ├── jwt.ts             # Geração/verificação de tokens
│   │   │   ├── priceEstimator.ts  # Algoritmo de estimativa de preço
│   │   │   └── response.ts        # Padronização de respostas HTTP
│   │   └── app.ts                 # Express app setup
│   ├── server.ts                  # Entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
└── PROJETO.md                     # Este arquivo
```

---

## Modelo de Dados (Entidades Principais)

### users
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK |
| name | String | Nome completo |
| email | String | E-mail único |
| password | String | Hash bcrypt |
| phone | String | Telefone |
| role | Enum | CLIENT / PROVIDER / BOTH |
| avatar | String | URL da foto |
| bio | String | Descrição do prestador |
| document_verified | Boolean | Identidade verificada |
| rating_avg | Float | Média de avaliações |
| rating_count | Int | Total de avaliações |
| is_active | Boolean | Conta ativa |
| created_at | DateTime | — |

### categories (Categorias de Serviço)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK |
| name | String | Nome do serviço |
| slug | String | URL amigável |
| group | String | Grupo (Para Sua Casa, etc.) |
| icon | String | Emoji/ícone |
| description | String | Descrição |
| base_price_min | Float | Preço mínimo estimado |
| base_price_max | Float | Preço máximo estimado |
| requires_photos | Boolean | Exige fotos no pedido |
| is_active | Boolean | — |

### questionnaire_fields (Perguntas por Serviço)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK |
| category_id | UUID | FK → categories |
| question | String | Texto da pergunta |
| field_type | Enum | TEXT / SELECT / RADIO / BOOLEAN / PHOTO / NUMBER |
| options | JSON | Opções para SELECT/RADIO |
| is_required | Boolean | Campo obrigatório |
| order | Int | Ordem de exibição |
| affects_price | Boolean | Influencia no preço estimado |
| price_modifier | JSON | Multiplicadores por opção |

### orders (Pedidos de Serviço)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK |
| client_id | UUID | FK → users |
| category_id | UUID | FK → categories |
| title | String | Título gerado automaticamente |
| description | String | Descrição adicional |
| answers | JSON | Respostas do questionário |
| photos | String[] | URLs das fotos enviadas |
| status | Enum | OPEN / IN_PROPOSAL / ACCEPTED / SCHEDULED / IN_PROGRESS / DONE / RATED / CANCELLED / DISPUTED |
| desired_date | DateTime | Data/hora desejada |
| address | String | Endereço do serviço |
| latitude | Float | Geolocalização |
| longitude | Float | Geolocalização |
| estimated_price_min | Float | Estimativa mínima |
| estimated_price_max | Float | Estimativa máxima |
| final_price | Float | Preço acordado |
| created_at | DateTime | — |

### proposals (Propostas dos Prestadores)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK |
| order_id | UUID | FK → orders |
| provider_id | UUID | FK → users |
| value | Float | Valor proposto |
| message | String | Mensagem ao cliente |
| status | Enum | PENDING / ACCEPTED / REJECTED / CANCELLED |
| created_at | DateTime | — |

### schedules (Agendamentos)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK |
| order_id | UUID | FK → orders |
| proposal_id | UUID | FK → proposals |
| provider_id | UUID | FK → users |
| client_id | UUID | FK → users |
| scheduled_at | DateTime | Data/hora confirmada |
| checkin_at | DateTime | Check-in do prestador |
| done_at | DateTime | Conclusão |
| status | Enum | CONFIRMED / IN_PROGRESS / DONE / CANCELLED |

### ratings (Avaliações)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK |
| schedule_id | UUID | FK → schedules |
| reviewer_id | UUID | Quem avaliou |
| reviewed_id | UUID | Quem foi avaliado |
| score | Int | 1–5 estrelas |
| comment | String | Comentário |
| reviewer_role | Enum | CLIENT / PROVIDER |
| created_at | DateTime | — |

### provider_skills (Habilidades do Prestador)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK |
| provider_id | UUID | FK → users |
| category_id | UUID | FK → categories |
| years_experience | Int | Anos de experiência |
| certification | String | Certificação/curso |
| service_radius_km | Int | Raio de atendimento |
| hourly_rate | Float | Valor hora referência |

---

## Rotas da API (Endpoints)

### Auth
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/auth/register | Registro de usuário |
| POST | /api/auth/login | Login |
| POST | /api/auth/refresh | Renovar access token |
| POST | /api/auth/logout | Logout (invalida refresh) |
| POST | /api/auth/forgot-password | Solicitar reset de senha |
| POST | /api/auth/reset-password | Resetar senha |

### Users
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/users/me | Perfil próprio |
| PUT | /api/users/me | Atualizar perfil |
| GET | /api/users/:id | Perfil público de usuário |
| POST | /api/users/me/avatar | Upload de foto de perfil |
| POST | /api/users/me/skills | Adicionar habilidade (prestador) |
| GET | /api/users/me/skills | Listar habilidades próprias |
| DELETE | /api/users/me/skills/:id | Remover habilidade |

### Categories
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/categories | Listar todas as categorias |
| GET | /api/categories/groups | Listar grupos |
| GET | /api/categories/:slug | Detalhes de uma categoria |
| GET | /api/categories/:slug/questionnaire | Questionário da categoria |

### Orders
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/orders | Criar pedido |
| GET | /api/orders | Listar pedidos do cliente |
| GET | /api/orders/feed | Feed para prestadores |
| GET | /api/orders/:id | Detalhes do pedido |
| PUT | /api/orders/:id | Atualizar pedido (antes do aceite) |
| DELETE | /api/orders/:id | Cancelar pedido |
| POST | /api/orders/:id/photos | Upload de fotos do pedido |

### Proposals
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/orders/:id/proposals | Criar proposta |
| GET | /api/orders/:id/proposals | Listar propostas do pedido |
| PUT | /api/proposals/:id | Editar proposta |
| DELETE | /api/proposals/:id | Cancelar proposta |
| POST | /api/proposals/:id/accept | Cliente aceita proposta |
| POST | /api/proposals/:id/reject | Cliente rejeita proposta |

### Schedules
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/schedules | Agendamentos do usuário |
| GET | /api/schedules/:id | Detalhes do agendamento |
| POST | /api/schedules/:id/checkin | Prestador faz check-in |
| POST | /api/schedules/:id/complete | Prestador marca como concluído |
| POST | /api/schedules/:id/confirm | Cliente confirma conclusão |

### Ratings
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/schedules/:id/rate | Avaliar após serviço |
| GET | /api/users/:id/ratings | Avaliações de um usuário |

---

## Algoritmo de Estimativa de Preço

```
preço_base = categoria.base_price_min até base_price_max
para cada resposta do questionário:
  se resposta.affects_price:
    preço_base *= price_modifier[valor_da_resposta]
preço_final_estimado = preço_base
```

---

## Regras de Negócio Importantes

1. **Duplo perfil**: Um usuário pode ser cliente E prestador simultaneamente
2. **Feed filtrado**: Prestador vê apenas pedidos das categorias em que tem habilidade cadastrada, dentro do seu raio de atendimento
3. **Proposta única por pedido**: Cada prestador pode enviar apenas 1 proposta por pedido
4. **Escrow**: Pagamento bloqueado no aceite, liberado apenas após confirmação do cliente
5. **Avaliação dupla**: Ambos avaliam após conclusão (cliente avalia prestador e vice-versa)
6. **Cancelamento**: Permitido antes do check-in; após check-in requer disputa

---

## Histórico de Desenvolvimento

### ✅ Passo 1 — Planejamento e Documentação (2026-05-29)
- Análise dos repositórios GitHub disponíveis
- Definição de stack tecnológica
- Mapeamento completo de funcionalidades (60+ serviços em 10 grupos)
- Criação deste arquivo de documentação

### ✅ Passo 2 — Inicialização do Projeto Backend (2026-05-29)
- Estrutura de pastas criada (`backend/src/modules/...`)
- `package.json` com todas as dependências (Express, Prisma, JWT, Zod, Multer, etc.)
- `tsconfig.json` configurado
- `.env.example` com todas as variáveis documentadas
- `.gitignore` configurado

### ✅ Passo 3 — Banco de Dados com Prisma (2026-05-29)
- `prisma/schema.prisma` completo com todos os models e enums:
  - `User`, `RefreshToken`, `ServiceGroup`, `Category`
  - `QuestionnaireField`, `ProviderSkill`, `Order`
  - `Proposal`, `Schedule`, `Rating`, `Message`
- `prisma/seed.ts` com dados completos:
  - **10 grupos** de serviço
  - **25+ categorias** com questionários dinâmicos completos
  - Cada categoria tem 4-7 perguntas com opções, obrigatoriedade e modificadores de preço
  - 3 usuários de teste (admin, cliente, prestador)

### ✅ Passo 4 — Autenticação (2026-05-29)
Arquivos: `src/modules/auth/auth.controller.ts` + `auth.routes.ts`
- `POST /api/auth/register` — cadastro com validação Zod
- `POST /api/auth/login` — login com bcrypt + JWT
- `POST /api/auth/refresh` — renovação de token
- `POST /api/auth/logout` — invalida refresh token
- Middleware `authenticate` (verifica Bearer token)
- Middleware `requireRole` (controle por perfil)

### ✅ Passo 5 — Módulo de Usuários (2026-05-29)
Arquivos: `src/modules/users/users.controller.ts` + `users.routes.ts`
- `GET /api/users/me` — perfil próprio com habilidades
- `PUT /api/users/me` — atualizar nome, bio, telefone, papel
- `POST /api/users/me/avatar` — upload de foto de perfil
- `PUT /api/users/me/password` — troca de senha
- `POST /api/users/me/skills` — cadastrar habilidade (prestador)
- `GET /api/users/me/skills` — listar habilidades
- `DELETE /api/users/me/skills/:id` — remover habilidade
- `GET /api/users/:id` — perfil público com avaliações

### ✅ Passo 6 — Módulo de Categorias (2026-05-29)
Arquivos: `src/modules/categories/categories.controller.ts` + `categories.routes.ts`
- `GET /api/categories/groups` — todos os grupos com categorias aninhadas
- `GET /api/categories` — listar todas (com filtro por grupo)
- `GET /api/categories/:slug` — detalhes de uma categoria
- `GET /api/categories/:slug/questionnaire` — retorna questionário dinâmico completo

### ✅ Passo 7 — Módulo de Pedidos (2026-05-29)
Arquivos: `src/modules/orders/orders.controller.ts` + `orders.routes.ts`
- `POST /api/orders` — criar pedido (valida campos obrigatórios + calcula preço)
- `GET /api/orders` — listar meus pedidos (cliente)
- `GET /api/orders/feed` — feed para prestadores (filtrado por habilidade)
- `GET /api/orders/:id` — detalhes do pedido
- `POST /api/orders/:id/photos` — upload de fotos (até 5)
- `DELETE /api/orders/:id` — cancelar pedido

### ✅ Passo 8 — Módulo de Propostas (2026-05-29)
Arquivos: `src/modules/proposals/proposals.controller.ts` + `proposals.routes.ts`
- `POST /api/orders/:orderId/proposals` — prestador faz proposta (valida habilidade)
- `GET /api/orders/:orderId/proposals` — cliente vê propostas recebidas
- `POST /api/proposals/:id/accept` — aceitar proposta (cria agendamento automático, rejeita demais)
- `POST /api/proposals/:id/reject` — rejeitar proposta
- `DELETE /api/proposals/:id` — prestador cancela própria proposta

### ✅ Passo 9 — Módulo de Agendamentos (2026-05-29)
Arquivos: `src/modules/schedules/schedules.controller.ts` + `schedules.routes.ts`
- `GET /api/schedules` — meus agendamentos (cliente e prestador)
- `GET /api/schedules/:id` — detalhes com mensagens
- `POST /api/schedules/:id/checkin` — prestador faz check-in
- `POST /api/schedules/:id/complete` — prestador marca concluído
- `POST /api/schedules/:id/confirm` — cliente confirma conclusão

### ✅ Passo 10 — Módulo de Avaliações (2026-05-29)
Arquivos: `src/modules/ratings/ratings.controller.ts` + `ratings.routes.ts`
- `POST /api/schedules/:scheduleId/rate` — avaliar (1-5 estrelas + comentário)
- `GET /api/users/:userId/ratings` — listar avaliações de um usuário
- Recalculo automático da média após cada avaliação
- Pedido muda para status `RATED` quando ambos avaliarem

### ✅ Passo 11 — Entry Point e App (2026-05-29)
Arquivos: `src/app.ts`, `src/server.ts`
- Express configurado com CORS, JSON body parser
- Servindo arquivos de `/uploads` como estáticos
- Rota de health check em `GET /health`
- Todas as rotas montadas e organizadas
- Tratamento global de erros

---

## Estrutura de Pastas (Frontend)

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                   # Layout raiz (fontes, Toaster)
│   │   ├── page.tsx                     # Landing page (pública)
│   │   ├── globals.css                  # Tailwind imports
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx           # Tela de login
│   │   │   └── register/page.tsx        # Cadastro (escolha de perfil)
│   │   └── (app)/
│   │       ├── layout.tsx               # Layout autenticado (Navbar + guard)
│   │       ├── home/page.tsx            # Grupos de serviço + busca
│   │       ├── pedido/
│   │       │   ├── novo/[categorySlug]/ # Questionário dinâmico + criação
│   │       │   └── [id]/page.tsx        # Detalhe do pedido + propostas
│   │       ├── meus-pedidos/page.tsx    # Dashboard do cliente
│   │       ├── feed/page.tsx            # Feed do prestador
│   │       ├── agendamentos/
│   │       │   ├── page.tsx             # Lista de agendamentos
│   │       │   └── [id]/page.tsx        # Chat + ações do agendamento
│   │       └── perfil/
│   │           ├── page.tsx             # Ver perfil + habilidades + avaliações
│   │           └── editar/page.tsx      # Editar dados + alterar senha
│   ├── components/
│   │   ├── ui/                          # Button, Input, Card, Badge, Avatar,
│   │   │                                # StarRating, Spinner, Modal, Select, Textarea
│   │   └── layout/
│   │       └── Navbar.tsx               # Nav responsiva + menu usuário
│   ├── store/
│   │   └── auth.ts                      # Zustand store (user, tokens, logout)
│   ├── hooks/
│   │   └── useAuth.ts                   # Hook de autenticação + guard de rota
│   ├── lib/
│   │   ├── api.ts                       # Axios + interceptors (auto-refresh)
│   │   └── utils.ts                     # formatCurrency, formatDate, labels/cores de status
│   └── types/
│       └── index.ts                     # Todos os tipos TypeScript (User, Order, etc.)
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── .env.local.example
```

---

## Histórico de Desenvolvimento

### ✅ Passo 1 — Planejamento e Documentação (2026-05-29)
- Análise dos repositórios GitHub disponíveis
- Definição de stack tecnológica
- Mapeamento completo de funcionalidades (60+ serviços em 10 grupos)
- Criação deste arquivo de documentação

### ✅ Passo 2 — Inicialização do Projeto Backend (2026-05-29)
- Estrutura de pastas criada (`backend/src/modules/...`)
- `package.json` com todas as dependências (Express, Prisma, JWT, Zod, Multer, etc.)
- `tsconfig.json` configurado
- `.env.example` com todas as variáveis documentadas
- `.gitignore` configurado

### ✅ Passo 3 — Banco de Dados com Prisma (2026-05-29)
- `prisma/schema.prisma` completo com todos os models e enums
- `prisma/seed.ts` com dados completos: 10 grupos, 25+ categorias, questionários e usuários de teste

### ✅ Passo 4 — Autenticação (2026-05-29)
- `POST /api/auth/register`, `/login`, `/refresh`, `/logout`
- Middleware `authenticate` + `requireRole`

### ✅ Passo 5 — Módulo de Usuários (2026-05-29)
- CRUD de perfil, upload de avatar, gestão de habilidades do prestador

### ✅ Passo 6 — Módulo de Categorias (2026-05-29)
- Listagem de grupos, categorias e questionários dinâmicos

### ✅ Passo 7 — Módulo de Pedidos (2026-05-29)
- Criação de pedidos com validação e estimativa automática de preço
- Feed filtrado por habilidade do prestador

### ✅ Passo 8 — Módulo de Propostas (2026-05-29)
- Envio de proposta, aceite com criação automática de agendamento, rejeição

### ✅ Passo 9 — Módulo de Agendamentos (2026-05-29)
- Check-in, conclusão e confirmação com máquina de estados

### ✅ Passo 10 — Módulo de Avaliações (2026-05-29)
- Avaliação dupla (1-5 estrelas), recálculo de média, status RATED ao finalizar

### ✅ Passo 11 — Entry Point e App (2026-05-29)
- Express configurado com todas as rotas, health check, tratamento de erros

### ✅ Passo 12 — Módulo de Mensagens / Chat (2026-05-29)
Arquivos: `backend/src/modules/messages/messages.controller.ts` + `messages.routes.ts`
- `GET /api/schedules/:scheduleId/messages` — histórico (últimas 100 msgs)
- `POST /api/schedules/:scheduleId/messages` — enviar mensagem de texto
- Marca mensagens como lidas automaticamente ao listar
- Somente partes do agendamento (cliente e prestador) podem acessar

### ✅ Passo 13 — Frontend Next.js — Configuração e Base (2026-05-29)
- `package.json` com Next.js 14, TailwindCSS, Zustand, React Hook Form, Zod, Axios, Lucide, date-fns
- `tsconfig.json`, `next.config.js`, `tailwind.config.js`, `postcss.config.js`
- `src/types/index.ts` — todos os tipos TypeScript
- `src/lib/api.ts` — Axios com interceptors (injeção de token + auto-refresh em 401)
- `src/lib/utils.ts` — helpers de formatação, labels e cores de status
- `src/store/auth.ts` — Zustand com persist (tokens, user, logout)
- `src/hooks/useAuth.ts` — guard de rota por role

### ✅ Passo 14 — Frontend Next.js — Componentes UI (2026-05-29)
- `Button` — variantes primary/secondary/outline/ghost/danger + isLoading
- `Input`, `Textarea`, `Select` — com label, error, helpText
- `Card`, `CardHeader`, `CardBody`, `CardFooter`
- `Badge` — variantes de cor por status
- `Avatar` — com fallback em iniciais
- `StarRating` — interativo e somente leitura
- `Spinner`, `PageSpinner` — indicadores de carregamento
- `Modal` — overlay com animação
- `Navbar` — responsiva, menu mobile, dropdown de usuário, filtro por role

### ✅ Passo 15 — Frontend Next.js — Telas e Navegação (2026-05-29)
**Área pública:**
- `app/page.tsx` — Landing page com hero, categorias e features
- `app/(auth)/login/page.tsx` — Formulário de login com toggle de senha
- `app/(auth)/register/page.tsx` — Cadastro com seletor de tipo de conta (Cliente / Prestador / Ambos)

**Área autenticada (layout com Navbar + guard automático):**
- `app/(app)/home/page.tsx` — Grupos de serviço com busca em tempo real, grid de categorias
- `app/(app)/pedido/novo/[categorySlug]/page.tsx` — Questionário dinâmico completo:
  - Renderiza TEXT, TEXTAREA, SELECT, RADIO, BOOLEAN, DATE, NUMBER
  - Upload de fotos (até 5, preview imediato)
  - Estimativa de preço exibida
  - Campos de agendamento (data/hora) e localização
- `app/(app)/pedido/[id]/page.tsx` — Detalhe do pedido com:
  - Status, fotos, dados de localização/data
  - Lista de propostas com perfil do prestador (visível para cliente)
  - Aceitar / rejeitar propostas
  - Botão "Fazer Proposta" para prestadores (com modal)
  - Cancelar pedido
- `app/(app)/meus-pedidos/page.tsx` — Dashboard do cliente com filtros por status e paginação
- `app/(app)/feed/page.tsx` — Feed do prestador com filtro por habilidades, fotos, preview
- `app/(app)/agendamentos/page.tsx` — Lista de agendamentos com status visual
- `app/(app)/agendamentos/[id]/page.tsx` — Detalhe com:
  - Info das partes (cliente ↔ prestador)
  - Botões de ação (Check-in, Concluir, Confirmar)
  - Chat em tempo real (scroll automático, Enter para enviar)
  - Modal de avaliação com StarRating interativo
- `app/(app)/perfil/page.tsx` — Perfil com upload de foto, habilidades (add/remove), avaliações recebidas
- `app/(app)/perfil/editar/page.tsx` — Editar nome, bio, telefone, tipo de conta + alterar senha

---

## Próximos Passos

### ⏳ Passo 16 — Instalação e Primeira Execução
```bash
# Backend
cd backend
npm install
cp .env.example .env
# Editar .env com credenciais do PostgreSQL
npx prisma migrate dev --name init
npm run db:seed
npm run dev  # roda na porta 3333

# Frontend (em outro terminal)
cd frontend
npm install
cp .env.local.example .env.local
npm run dev  # roda na porta 3000
```

### ✅ Passo 17 — Geolocalização e Taxa de Plataforma (2026-05-30)

**Geolocalização:**
- `User` agora armazena `latitude` / `longitude` (localização base do prestador)
- Migration `20260530201603_add_geo_and_fees` aplicada
- `utils/geo.ts` com fórmula Haversine para calcular distância entre dois pontos
- `GET /api/orders/feed` agora filtra pedidos pelo raio de atendimento do prestador (por categoria) e ordena por distância; retorna `distance_km` em cada pedido e `provider_has_location` flag
- `PUT /api/users/me` aceita `latitude` e `longitude`
- Frontend — perfil/editar: botão "Usar minha localização" via `navigator.geolocation`
- Frontend — feed: toggle Lista / Mapa (Leaflet + OpenStreetMap, sem API key); banner de aviso quando localização não configurada; distância exibida em cada card; preview do valor que o prestador recebe (~88% da estimativa)
- Frontend — `MapView.tsx`: componente com `dynamic import` (sem SSR), marcador azul do prestador, marcadores de pedidos com popup de detalhes

**Taxa de Plataforma:**
- `Order` agora tem `platform_fee_pct` (default 0.12), `platform_fee_value` e `provider_amount`
- `POST /api/proposals/:id/accept`: calcula automaticamente 12% de taxa e armazena breakdown no pedido; retorna os valores na resposta
- Frontend — pedido/[id]: modal de proposta exibe em tempo real o breakdown (valor bruto → taxa → o que o prestador recebe); após aceite, bloco "Detalhamento do pagamento" visível para ambas as partes

### ✅ Passo 18 — Pagamentos Stripe + Escrow + Saque PIX (2026-05-30)

**Backend:**
- Novos models no Prisma: `Payment` (escrow) e `ProviderWithdrawal` (saques PIX)
- Novos campos: `User.pix_key`, `User.pix_key_type`, `User.provider_balance`, `User.stripe_customer_id`; `Order.stripe_payment_intent_id`
- Novos enums: `PaymentStatus`, `WithdrawalStatus`
- `src/modules/payments/stripe.ts` — cliente Stripe singleton
- `src/modules/payments/payments.controller.ts`:
  - `createPaymentIntent()` — cria PaymentIntent no Stripe após aceite de proposta
  - `GET /api/payments/order/:orderId` — status do pagamento
  - `POST /api/payments/webhook` — webhook Stripe (`payment_intent.succeeded` → status PAID + SCHEDULED)
  - `POST /api/payments/simulate` — simula pagamento (apenas dev, sem Stripe)
  - `GET /api/payments/my-balance` — saldo disponível do prestador
  - `POST /api/payments/withdrawal` — solicitar saque PIX (bloqueia saldo imediatamente)
  - `GET /api/payments/withdrawals` — histórico de saques
  - `PUT /api/payments/pix-key` — cadastrar/alterar chave PIX
  - `PUT /api/payments/withdrawals/:id/approve` — admin aprova saque
  - `PUT /api/payments/withdrawals/:id/reject` — admin rejeita + devolve saldo
- `proposals.controller.ts` atualizado: `acceptProposal` cria PaymentIntent; status do pedido vai para `ACCEPTED` (aguardando pagamento) se Stripe configurado
- `schedules.controller.ts` atualizado: `confirmByClient` libera pagamento ao prestador (`RELEASED`) e incrementa `provider_balance`
- `app.ts`: webhook montado com `express.raw()` antes do `express.json()`; rotas `/api/payments` registradas

**Frontend:**
- `@stripe/react-stripe-js` e `@stripe/stripe-js` adicionados ao package.json
- Novos tipos: `Payment`, `ProviderWithdrawal`, `BalanceData`, `PaymentStatus`, `WithdrawalStatus`, `PixKeyType`
- `app/(app)/pagamento/[orderId]/page.tsx` — tela de pagamento com Stripe Elements (cartão); modo simulação quando Stripe não configurado
- `app/(app)/carteira/page.tsx` — carteira do prestador: saldo disponível, cadastro de chave PIX, solicitação de saque, histórico de saques com status visual
- `pedido/[id]/page.tsx` atualizado: banner de pagamento pendente (orange), badge de escrow ativo (blue) e pagamento liberado (green); redirect para `/pagamento/:id` ao aceitar proposta
- Navbar: link "Carteira" adicionado para prestadores

**Fluxo completo de escrow:**
1. Cliente aceita proposta → PaymentIntent criado → redirect para `/pagamento/:orderId`
2. Cliente paga com cartão → Stripe webhook → `Payment.status = PAID`, `Order.status = SCHEDULED`
3. Serviço executado → prestador marca concluído → cliente confirma
4. `confirmByClient` → `Payment.status = RELEASED`, `User.provider_balance += provider_amount`
5. Prestador solicita saque PIX → plataforma aprova → PIX enviado manualmente

### ⏳ Passo 18 — App Mobile React Native (Fase 3)
- Expo + React Native
- Push notifications
- GPS tracking (opt-in)

---

*Última atualização: 2026-05-30 — Passo 18 concluído. Sistema de pagamentos Stripe + Escrow + Saque PIX implantados.*
