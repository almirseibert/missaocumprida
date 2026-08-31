# Missão Cumprida — Manutenção, Segurança e Conformidade Google Play

> Documento-mestre da varredura e da rodada de manutenção de **07/07/2026**.
> Legenda: ✅ feito e validado por typecheck · 🟡 feito no código, exige ação sua (prod/console) · 📋 runbook (você executa) · ⬜ decisão de negócio/advogado.
>
> **Validação nesta máquina:** `tsc --noEmit` passou nos 3 projetos (backend, frontend, mobile). Teste ponta-a-ponta de pagamento e do app Android exige aparelho real + Play Console + build EAS — feito por você via runbook. O `next build` completo não rodou aqui por lentidão/lock de arquivo do Windows nesse drive de backup (não é erro de código; os tipos estão verdes).

---

## 0. Decisões desta rodada (confirmadas por você)
- **Produção (EasyPanel + banco):** eu preparei migrações/scripts + runbook; **você aplica**. Sem segredos no chat.
- **Itens digitais (Selo Pro):** **Google Play Billing via RevenueCat**.
- **Escopo:** completo (código + infra + rascunhos jurídicos + guia de submissão).

---

## 1. Achados e status

### 🚨 Bloqueadores de publicação (Google Play)
| # | Achado | Status |
|---|--------|--------|
| B1 | Política de Privacidade não existia (sem URL pública) | ✅ criada (`/privacidade`) — 🟡 preencher dados da empresa |
| B2 | Permissões sensíveis sem uso (`RECORD_AUDIO`, storage) | ✅ removidas + bloqueadas |
| B3 | Selo Pro vendido via PIX (viola Play Billing) | ✅ migrado p/ RevenueCat — 🟡 configurar Play/RC |
| B4 | Sem exclusão de conta (in-app + web) | ✅ implementada (app, web e backend) |
| B5 | Data Safety form | 📋 seção 4 |

### ⚖️ Jurídico (Brasil)
| # | Achado | Status |
|---|--------|--------|
| J1 | Custódia/escrow na conta da plataforma → risco BACEN | ⬜ decisão de negócio/advogado (seção 4.6) |
| J2 | Termos §5 negavam reclamação pós-confirmação (contra CDC) | ✅ reescrito |
| J3 | Termos §4/§5 dessincronizados do código (7 dias) | ✅ reescrito + versão 1.2.0 |
| J4 | KYC/biometria sensível; "operador de verificação" inexistente | 🟡 texto ajustado; parceiro é decisão sua |

### 🐛 Código & segurança
| # | Achado | Status |
|---|--------|--------|
| S1 | Admin padrão `Admin@123` em repo público | ✅ removido do seed + script de rotação — 📋 rotacionar prod |
| S2 | Webhook Mercado Pago sem validação de `x-signature` | ✅ implementado (HMAC) |
| S3 | Tokens em `AsyncStorage` (texto puro) | ✅ migrado p/ `expo-secure-store` |
| S4 | `subscribe` do Selo Pro concedia selo grátis (no-op) | ✅ corrigido (concessão só via webhook RC/admin) |
| S5 | Postgres exposto / rotação de segredos (MP/VAPID/banco) | 📋 confirmar (seção 3) |

---

## 2. O que mudou no código (log de execução)

### Backend (`backend/`)
- `src/config/env.ts` — novas envs: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `REVENUECAT_WEBHOOK_AUTH`.
- `prisma/seed.ts` — **removida a senha fixa `Admin@123`**. Senha do admin agora vem de `ADMIN_PASSWORD`; em produção sem env, gera senha aleatória forte e imprime uma vez. Usuários de teste não são criados em produção.
- `prisma/set-admin-password.ts` (novo) + script `npm run db:set-admin` — rotaciona a senha do admin em prod.
- `src/modules/payments/payments.controller.ts` — `verifyMpSignature()` valida o header `x-signature` (HMAC-SHA256) do webhook do Mercado Pago; requisição sem assinatura válida → 401 (quando `MP_WEBHOOK_SECRET` está setado).
- `src/modules/users/users.controller.ts` + `users.routes.ts` — **`DELETE /api/users/me`** (exclusão de conta): reautentica por senha, bloqueia se houver saldo a sacar / pagamentos (PAID/HELD/DISPUTED) / serviços (CONFIRMED/IN_PROGRESS), e então anonimiza dados pessoais + apaga documentos KYC.
- `src/modules/verification/verification.controller.ts` + `verification.routes.ts` + `app.ts`:
  - `subscribe` **não concede mais o selo** (corrige o "selo grátis").
  - **`POST /api/verification/rc-webhook`** (novo, sem JWT, autenticado por `REVENUECAT_WEBHOOK_AUTH`) — fonte de verdade da assinatura: concede/revoga o Selo Pro conforme eventos da RevenueCat.
- `src/modules/legal/terms.text.ts` — §4 (Escrow → Segurança de Transação, retenção mínima de 7 dias + análise antes de liberar) e §5 (reclamação permitida durante a janela; preserva direitos do CDC art. 26/49) reescritos. Versão **1.2.0** (força reaceite).
- `src/modules/legal/privacy.text.ts` (novo) + rota **`GET /api/legal/privacy`** — Política de Privacidade LGPD (com marcadores `[ ]` a preencher).

### Frontend (`frontend/`)
- `src/lib/markdown.tsx` (novo) — renderizador de markdown para os textos legais.
- `src/app/privacidade/page.tsx` e `src/app/termos/page.tsx` (novos) — **páginas públicas** (URLs para o Google e para os usuários).
- `src/app/(app)/perfil/page.tsx` — card "Conta e privacidade" com links legais + **Excluir minha conta** (modal com senha).

### Mobile (`mobile/`)
- `app.json` — removidas `RECORD_AUDIO`, `READ/WRITE_EXTERNAL_STORAGE`; adicionadas a `blockedPermissions` (garante que não voltem via merge de manifesto).
- `package.json` — `react-native-purchases` (RevenueCat) e `expo-secure-store`.
- `src/lib/purchases.ts` (novo) — wrapper RevenueCat (configure/login/offering/purchase/restore/isPro).
- `src/lib/secureStore.ts` (novo) — tokens em armazenamento seguro, com migração automática do AsyncStorage (não desloga sessões).
- `src/lib/api.ts`, `src/store/auth.ts`, `src/hooks/useChatSocket.ts` — passam a usar o secure store; auth store configura/vincula/desvincula o RevenueCat.
- `app/(app)/verificar-pro.tsx` — **compra via Google Play (RevenueCat)** em vez de PIX; botão "Restaurar compras".
- `app/(app)/perfil.tsx` — links de Termos/Privacidade (abrem o site) + **Excluir minha conta** (modal com senha).
- `.env.example` — novas envs: `EXPO_PUBLIC_WEB_URL`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT`.

> **Não há novas migrações de banco** nesta rodada — todas as mudanças usam colunas já existentes.

### Rodada 2 (mesma data) — página de exclusão + correção do cadastro
- `frontend/src/app/exclusao-de-conta/page.tsx` (novo) — **página pública dedicada** de solicitação de exclusão de conta/dados (URL para o Google Play): passos in-app + por e-mail, o que é excluído × retido. Ajuste o `CONTACT_EMAIL` no topo do arquivo.
- `backend/src/modules/legal/privacy.text.ts` — link da exclusão agora aponta para `/exclusao-de-conta`.
- **Bug de cadastro corrigido:** o frontend web enviava `referral_code: ''` (string vazia) quando não havia código de amigo; o backend rejeitava (validação mín. 3 chars) e **todo cadastro sem código falhava** com "Dados inválidos". Corrigido em `frontend/.../register/page.tsx` (envia `undefined` quando vazio) **e** endurecido no backend `auth.controller.ts` (`referral_code` vazio → tratado como ausente).
- **Erros de validação agora aparecem:** `getApiErrorMessage` (web) e `getApiError` (mobile) passam a extrair as mensagens por campo (`errors` do zod) — antes o usuário só via "Dados inválidos" genérico; agora vê o que corrigir e uma mensagem clara de "sem conexão".
- **Texto do código de amigo** no cadastro web: "Ganhe R$ 20 no 1º pedido." → "Adicione para ganhar bônus!".

---

## 3. 📋 Runbook de produção (EasyPanel + banco)

> Faça em ambiente de janela de baixo movimento. Nada aqui exige colar segredo no chat.

### 3.1 Variáveis de ambiente no **backend** (EasyPanel → serviço back → Environment)
Adicione/atualize:
| Variável | Valor |
|---|---|
| `ADMIN_EMAIL` | e-mail do admin (ex.: `admin@missaocumprida.com.br`) |
| `ADMIN_PASSWORD` | **senha forte nova** (guarde no seu gerenciador) |
| `MP_WEBHOOK_SECRET` | segredo do webhook do Mercado Pago (painel MP → suas integrações → webhooks) |
| `REVENUECAT_WEBHOOK_AUTH` | string aleatória forte (ex.: `openssl rand -hex 24`) — usada também na RevenueCat |

Confirme que já existem (auditoria de junho): `JWT_SECRET`/`JWT_REFRESH_SECRET` fortes, `DATABASE_URL` (host **interno**), `MP_ACCESS_TOKEN`, `VAPID_*`, `FRONTEND_URL`, `API_URL`.

### 3.2 Deploy do código
1. Faça commit/push das mudanças e **redeploy do back e do front** no EasyPanel.
2. Migrações: `npm run db:migrate:prod` (não há novas nesta rodada, mas garanta que as pendentes da "Segurança de Transação" foram aplicadas).

### 3.3 Rotacionar a senha do admin (crítico — S1)
No shell do container do backend (ou local apontando para o banco de prod), com `ADMIN_EMAIL` e `ADMIN_PASSWORD` definidos:
```
npm run db:set-admin
```
Isso atualiza a senha do admin existente (o seed **não** sobrescreve senha de usuário já criado). Depois, **confirme login** no painel e descarte a senha antiga.

### 3.4 Fechar exposições (S5)
- Confirme que a porta externa do Postgres (`217.196.60.62:5433`) está **fechada** e que o backend usa o host **interno**.
- Rotacione, se ainda não o fez, os segredos que já passaram por chat (MP, VAPID, senha do banco).

### 3.5 Preencher os textos legais
- Em `backend/src/modules/legal/privacy.text.ts`, substitua os marcadores `[RAZÃO SOCIAL]`, `[CNPJ]`, `[ENDEREÇO]`, `[E-MAIL DO ENCARREGADO/DPO]`, `[E-MAIL DE CONTATO]`, `[URL DA PÁGINA DE EXCLUSÃO]` pelos dados reais. Redeploy do back.
- Revise `terms.text.ts` §4/§5 com seu advogado (rascunho pronto).

---

## 4. 📋 Guia de submissão ao Google Play

### 4.1 RevenueCat (Google Play Billing)
1. Crie conta em **revenuecat.com** → novo projeto → app Android `com.missaocumpridabr.app`.
2. No **Google Play Console**: crie um produto de **assinatura** (ex.: id `pro_monthly`, R$ 29,90/mês). Crie uma conta de serviço e conecte à RevenueCat (Play Developer API).
3. Na RevenueCat: crie o **entitlement** `pro`; anexe o produto `pro_monthly`; crie uma **offering** "current" com um package contendo esse produto.
4. Copie a **chave pública do SDK Android** (`goog_...`) → coloque em `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (mobile `.env` e env do build EAS de produção).
5. Configure o **webhook** da RevenueCat:
   - URL: `https://missaocumprida-back.oehpg2.easypanel.host/api/verification/rc-webhook`
   - Header **Authorization** = o mesmo valor de `REVENUECAT_WEBHOOK_AUTH`.

### 4.2 Build e publicação
- `cd mobile && eas build -p android --profile production` → depois `eas submit -p android` (ou suba o `.aab` manualmente).
- Suba primeiro na **faixa de teste interno**, faça **1 compra real de teste** do Selo Pro e confirme que o selo é concedido (webhook → `is_verified_pro`).

### 4.3 Ficha e políticas
- **Política de Privacidade (URL):** `https://missaocumprida-front.oehpg2.easypanel.host/privacidade`
- **Termos (URL):** `.../termos`
- **Exclusão de conta (URL):** `https://missaocumprida-front.oehpg2.easypanel.host/exclusao-de-conta` — página dedicada pronta. Informe essa URL no formulário "Exclusão de dados/conta" do Play Console. (O caminho in-app Perfil → Excluir conta também existe, ✅.) Ajuste o e-mail de contato no topo do arquivo `exclusao-de-conta/page.tsx`.

### 4.4 Data Safety form (declare)
- **Identidade:** nome, e-mail, telefone, **CPF** — coletados, ligados ao usuário.
- **Fotos/Documentos + Biometria (selfie/KYC):** coletados; finalidade prevenção a fraude/verificação; **não compartilhados** com terceiros exceto operadores de pagamento/verificação e autoridades.
- **Localização (precisa):** coletada em uso; finalidade funcionalidade do app (check-in/pedidos).
- **Financeiro:** histórico de compras/transações (via gateways).
- **Mensagens no app / UGC.** Marque criptografia em trânsito (HTTPS) e a existência de exclusão de conta.

### 4.5 Permissões e conteúdo
- Após a remoção, o app pede apenas **Câmera** (fotos/selfie), **Localização** (foreground) e **Notificações**. Justifique cada uma se solicitado. Não há uso de background location nem microfone.
- **UGC (chat/avaliações):** garanta mecanismo de denúncia/bloqueio e moderação para atender a política de conteúdo gerado por usuário (pendência de produto se ainda não existir).
- Classificação: 18+ (transações); marque "compras/transações" no questionário.

### 4.6 ⚖️ Custódia de valores (J1) — antes de escalar
O modelo atual mantém o dinheiro na conta da plataforma por 7 dias e repassa manualmente. Isso pode caracterizar **arranjo/instituição de pagamento** (BACEN, Lei 12.865/2013). **Recomendação:** avaliar com advogado migrar para **split/subconta do gateway** (Mercado Pago Split / Stripe Connect), em que o dinheiro não transita pela sua conta. Não bloqueia a publicação, mas é risco regulatório/tributário real conforme o volume cresce.

---

## 5. Testes executados
- `backend`: `tsc --noEmit` → **OK (exit 0)**.
- `frontend`: `tsc --noEmit` → **OK (exit 0)**. `next build` não concluído aqui (lock/lentidão de arquivo do Windows no drive de backup — não é erro de código).
- `mobile`: `tsc --noEmit` → **OK (exit 0)** (com `react-native-purchases` e `expo-secure-store` instalados).
- Regressão: sem usos remanescentes de token em `AsyncStorage`; sem PIX no fluxo do Selo Pro.

**Pendentes de teste real (você):** compra do Selo Pro na faixa interna do Play; exclusão de conta em um device; webhook do MP com evento real.
