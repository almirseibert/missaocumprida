# Missão Cumprida — Briefing para simulação MiroFish

> **Objetivo da simulação:** prever se o lançamento do app **Missão Cumprida** na **Google Play (Brasil)** tende ao sucesso, e em quais cenários. Rodar agentes de IA representando clientes, prestadores e concorrentes para estimar adoção, retenção, liquidez do marketplace e probabilidade de sucesso.

> **Importante (não inventar dados):** o produto está **pré-lançamento**; a base atual é de **testes**, sem histórico de uso real. A simulação deve estimar a adoção a partir do **produto, mercado e personas** descritos abaixo — não de métricas reais (elas ainda não existem).

---

## 1. Resumo executivo
Missão Cumprida é um **marketplace de serviços sob demanda** (mão de obra e serviços locais) para o **Brasil**. Conecta **clientes** que precisam de serviços (limpeza, reparos, reformas, elétrica/hidráulica, jardinagem, aulas, beleza, eventos, fretes, etc.) a **prestadores autônomos** da região. É um modelo **de dois lados (two-sided)** com **pagamento em garantia (escrow)**, agendamento, **check-in com foto + GPS**, conclusão comprovada e **avaliações**. Disponível como **app mobile (Android/Google Play)** e **web**.

## 2. Proposta de valor
**Para o cliente:**
- Encontra prestador **verificado** (documento + selfie) na sua região.
- Recebe **preço estimado** automático a partir de um questionário.
- Paga com **segurança**: o dinheiro fica retido e só é liberado ao prestador **após a conclusão + uma janela de 7 dias** para reclamação ("Segurança de Transação").
- Acompanha o serviço com **fotos e GPS** de check-in e conclusão.

**Para o prestador:**
- Recebe **pedidos qualificados** perto dele e envia **propostas**.
- Recebe pagamento via **PIX**; constrói **reputação** (notas) e pode obter **Selo Verificado Pro**.
- Ferramentas: pacotes de serviço, agenda, recorrência, modo urgência, boost de proposta.

## 3. Como funciona (fluxo principal)
1. Cliente escolhe a **categoria** e responde um **questionário** → recebe **preço estimado**.
2. Cliente **publica o pedido** (com fotos e localização).
3. Prestadores da região **enviam propostas** (valor + mensagem).
4. Cliente **aceita** uma proposta e **paga** (PIX ou cartão) → valor entra em **escrow**.
5. **Agendamento** confirmado; prestador faz **check-in** com **foto + GPS**.
6. Serviço executado; prestador marca **conclusão** com **foto + GPS**.
7. Cliente **confirma** a conclusão.
8. **Segurança de Transação:** o valor fica **em garantia por 7 dias** e passa por **revisão manual** antes de ser liberado (janela legal para reclamação/reembolso).
9. Valor **liberado** ao saldo do prestador → **saque via PIX**.
10. Ambos se **avaliam**.

## 4. Diferenciais (testar o impacto na confiança/conversão)
- **Segurança de Transação:** escrow + retenção de 7 dias + revisão manual → reduz medo de golpe dos dois lados.
- **Verificação KYC** (documento + selfie) dos prestadores.
- **Prova de execução** com foto + GPS no check-in e na conclusão.
- **Modo Urgência** (atende rápido, com taxa extra e raio expandido).
- **Pacotes de serviço** prontos e **recorrência/assinatura** (ex.: faxina semanal com desconto).
- **Programa de indicação** com bônus em crédito (motor de aquisição viral).
- **Selo Verificado Pro** (assinatura) e **boost de proposta** (monetização extra).
- **Preço estimado dinâmico** por questionário (reduz atrito de negociação).
- Pagamento **PIX instantâneo** (Mercado Pago) + **cartão** (Stripe).

## 5. Modelo de negócio / monetização
- **Take rate:** taxa da plataforma ~**10% do prestador** + taxa do **cliente ~10%**.
- **Gateway:** cartão ~4%, PIX ~1% (repassado).
- **Receitas extras:** Selo Verificado Pro (assinatura, ~R$29,90/mês), boost de proposta, pacotes.
- **Exemplo:** serviço de R$200 → cliente paga ~R$220; plataforma retém ~R$20–40; prestador recebe ~R$180 líquidos **após os 7 dias**.

## 6. Mercado-alvo e contexto (Brasil)
- Enorme **economia informal de serviços**; hoje a maior parte acontece via **indicação, WhatsApp e redes sociais**.
- **Alta penetração de Android** e adoção massiva do **PIX** → favorece app + pagamento instantâneo.
- Categorias: limpeza/diarista, reparos e manutenção, reformas, elétrica/hidráulica, montagem de móveis, jardinagem, pintura, aulas particulares, beleza, eventos, fretes/transporte.
- Estratégia de densidade: **regiões-piloto** (bairros/cidades) para criar liquidez local antes de expandir.

## 7. Personas (para popular os agentes da simulação)
**Clientes**
- **Mariana, 34, SP, classe média, trabalha fora:** quer **faxina recorrente**, valoriza segurança e praticidade, usa PIX e apps no dia a dia. Sensível a confiança.
- **Carlos, 45, proprietário de casa:** precisa de **reparos pontuais** (elétrica, hidráulica), **sensível a preço**, desconfiado de apps novos, hoje resolve por indicação.
- **Ana, 28, urbana, early adopter:** contrata **aulas/beleza**, super conectada, decide rápido, influenciável por avaliações e indicações.

**Prestadores**
- **João, 38, eletricista autônomo:** quer **mais clientes**, **sensível à taxa**, hoje fecha tudo por WhatsApp; testaria o app se trouxer demanda real.
- **Rosa, 50, diarista:** busca **recorrência/fidelidade**, confia em **indicação**, baixa afinidade com tecnologia (precisa de UX simples).
- **Diego, 26, generalista (montador/serviços gerais):** **early adopter**, quer **renda extra**, topa boost e selo para se destacar.

**Concorrência (agentes externos)**
- **GetNinjas** (líder; modelo de **venda de leads** — atrito alto para o prestador).
- **Triider, Parafuzo** (nichos como reforma/limpeza).
- **OLX Serviços**, **Facebook/WhatsApp/indicação informal** → **o maior concorrente real** é o "fora do app".

## 8. Diferenciação vs. concorrência (hipótese central)
A maioria dos concorrentes **vende leads** (o prestador paga para falar com o cliente, sem garantia de fechar) ou é **informal/sem segurança**. A Missão Cumprida aposta em **pagamento em garantia + prova de execução + verificação** para gerar **confiança** e só monetizar **sobre serviços concluídos** (take rate transacional, não venda de lead). Hipótese a validar na simulação: isso aumenta conversão e retenção o suficiente para superar o atrito de taxa (~20% total)?

## 9. Riscos conhecidos (modelar explicitamente)
- **Cold start two-sided / liquidez:** sem prestadores não há oferta; sem clientes não há demanda. Qual lado semear primeiro?
- **Desintermediação:** cliente e prestador fecharem "por fora" para evitar a taxa (mitigado por escrow, prova e reputação).
- **Sensibilidade à taxa** (~20% total somando os dois lados) — prestadores podem preferir o WhatsApp (0%).
- **Confiança/segurança e fraude** no início (poucas avaliações).
- **CAC** alto e concorrente estabelecido (GetNinjas) com awareness.
- **Retenção do prestador** se o volume de pedidos for baixo nas primeiras semanas.

## 10. Perguntas que a simulação deve responder
1. Probabilidade de **sucesso** do lançamento (definir sucesso — ver §11) em **3, 6 e 12 meses**.
2. O **cold start** trava? Qual estratégia de semeadura (prestador-primeiro vs cliente-primeiro vs região-piloto) maximiza liquidez?
3. **Sensibilidade à taxa:** em que nível de take rate os prestadores migram do WhatsApp?
4. Impacto da **Segurança de Transação** e da **verificação** na conversão e retenção.
5. **Densidade geográfica** mínima para liquidez (pedidos atendidos / tempo de resposta).
6. Efeito do **programa de indicação** no crescimento (coeficiente viral).
7. Cenários **otimista / base / pessimista** com faixas de downloads, GMV e retenção.

## 11. Definição de sucesso (alvos sugeridos — ajustar)
- **Aquisição:** ex. 10.000+ downloads em 6 meses; cadastro equilibrado dos dois lados.
- **Liquidez:** ≥ 60% dos pedidos recebem proposta em < 24h em regiões-piloto.
- **Retenção:** D30 ≥ 25% (cliente), prestadores ativos recorrentes.
- **Econômico:** GMV crescente, take rate efetivo ~15–20%, CAC < LTV.
- **Qualidade:** nota média ≥ 4,5; baixa taxa de disputa/reembolso.

## 12. Ficha técnica (contexto, não essencial à previsão)
- **Mobile:** React Native (Expo), publicação Android/Google Play.
- **Web:** Next.js. **Backend:** Node/Express + Prisma + PostgreSQL. **Realtime:** Socket.io (chat).
- **Pagamentos:** Mercado Pago (PIX) e Stripe (cartão). **Push:** Web Push / Expo.
- **País/idioma:** Brasil / português. **Moeda:** BRL.
