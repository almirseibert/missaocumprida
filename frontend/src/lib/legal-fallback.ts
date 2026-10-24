// =============================================================================
// Cópia estática de segurança dos textos legais.
// -----------------------------------------------------------------------------
// A FONTE DA VERDADE é o backend (backend/src/modules/legal/*.text.ts) — as
// páginas /termos e /privacidade buscam de lá. Este arquivo só é usado quando a
// API está fora do ar, para que a URL pública de privacidade (exigida pela
// Google Play) nunca renderize uma página de erro.
// Ao alterar os textos no backend, atualize também esta cópia.
// =============================================================================

export const TERMS_FALLBACK = {
  title: 'Termos de Uso e Política de Responsabilidade',
  effective_date: '2026-10-24',
  body: `
## 1. Aceitação e Natureza da Plataforma

A **Missão Cumprida** é uma **plataforma de intermediação** que conecta pessoas que desejam contratar serviços (CLIENTES) a pessoas que desejam oferecer seus serviços (PRESTADORES). A Missão Cumprida **não é** prestadora dos serviços anunciados, **não emprega** os prestadores e **não atua** como agência, empregadora ou representante de qualquer das partes.

Ao criar uma conta e utilizar a plataforma, você declara que **leu, compreendeu e aceita integralmente** estes Termos, bem como reconhece a natureza de mero intermediário tecnológico da plataforma.

## 2. Isenção de Responsabilidade da Plataforma

A Missão Cumprida **não se responsabiliza** por:

- a qualidade, segurança, legalidade, pontualidade, idoneidade ou adequação dos serviços contratados por meio da plataforma;
- a veracidade das informações declaradas por CLIENTES ou PRESTADORES em seus perfis;
- danos materiais, morais, físicos, patrimoniais ou de qualquer outra natureza decorrentes da execução, da não execução ou da má execução de um serviço;
- conflitos pessoais, divergências contratuais ou descumprimento de combinados firmados diretamente entre CLIENTE e PRESTADOR fora do escopo formalizado na plataforma;
- furto, dano, perda ou avaria de bens, no local de execução do serviço ou em trânsito;
- acidentes de trabalho, lesões, doenças ocupacionais ou qualquer evento físico ocorrido durante a prestação do serviço;
- atrasos, cancelamentos ou indisponibilidades de qualquer parte;
- conteúdo das conversas trocadas no chat interno.

**É dever de CLIENTE e PRESTADOR**, antes de fechar qualquer acordo, **buscar informações um sobre o outro**, conferir avaliações, perfis públicos, documentos, antecedentes e quaisquer outros elementos que julguem necessários à sua segurança e tranquilidade. A plataforma é apenas o meio de encontro — **a contratação é direta entre as partes**.

## 3. Cadastro, Veracidade de Dados e Verificação

O cadastro na plataforma exige fornecimento de dados pessoais completos, incluindo nome civil, CPF, RG, data de nascimento, endereço completo, telefone, contato de emergência e demais informações solicitadas. O usuário declara, sob as penas da lei, que **todas as informações fornecidas são verdadeiras, atuais e completas**, comprometendo-se a mantê-las atualizadas.

A Missão Cumprida poderá, a qualquer momento e a seu exclusivo critério, solicitar documentos comprobatórios, realizar verificações de antecedentes criminais, consultas a bureaus de crédito, verificação de telefone e endereço, validação biométrica, validação de documentos com OCR e demais conferências necessárias à integridade da base de usuários. **Você autoriza expressamente a Missão Cumprida a realizar tais consultas e a tratar os dados resultantes**, observados os limites da LGPD (Lei nº 13.709/2018).

Contas com dados falsos, inconsistentes ou identidade não confirmada serão suspensas ou removidas, podendo a Missão Cumprida comunicar autoridades competentes em caso de indícios de fraude ou crime.

**Uma conta por CPF.** Cada pessoa pode ter **apenas uma conta**, vinculada ao seu CPF. Não é permitido abrir outra conta com o mesmo CPF — nem com outro e-mail, nem depois de excluir a conta ou de ter sido banido. O CPF é exigido e validado antes do primeiro pedido ou da primeira proposta (na verificação de identidade). Se o seu CPF estiver vinculado a uma conta que você não reconhece, fale com o suporte para análise.

## 3.1. Verificação Obrigatória de Identidade (KYC)

Para utilizar a plataforma como CLIENTE ou PRESTADOR, é **obrigatório** o envio de:

- **Foto nítida de um documento oficial com foto** (RG, CNH, passaporte ou Carteira de Trabalho digital);
- **Selfie em tempo real**, segurando o documento ou em ambiente bem iluminado, para conferência biométrica.

Enquanto a verificação não for aprovada, o usuário **não poderá criar pedidos** (como cliente) nem **enviar propostas** (como prestador). A análise é realizada em até 48 horas úteis. Caso o material enviado não permita a verificação, o usuário será notificado com a justificativa e poderá reenviar.

**Finalidade do tratamento (LGPD art. 7º, V, IX e art. 11):** confirmação de identidade, prevenção a fraudes, segurança da comunidade e cumprimento de obrigações legais. **Base legal:** execução de contrato, legítimo interesse e proteção do crédito. **Retenção:** as imagens são armazenadas em ambiente seguro e mantidas pelo prazo mínimo necessário ao cumprimento da finalidade, até 5 (cinco) anos após o encerramento da conta, podendo o titular solicitar a anonimização ou exclusão por meio dos canais oficiais, ressalvadas obrigações legais de retenção.

**Não compartilhamento:** os documentos e a selfie não serão exibidos a outros usuários da plataforma nem compartilhados com terceiros, exceto (i) autoridades públicas mediante requisição legal, (ii) parceiros estritamente necessários para a verificação automatizada (ex.: serviços de OCR e validação biométrica), sob contrato de operador nos termos da LGPD.

Ao enviar os documentos, você declara que (a) os materiais retratam sua própria pessoa, (b) está ciente e consente com o tratamento descrito, e (c) tem direito legítimo de usar e enviar tais imagens.

## 4. Taxa de Conexão e Pagamento Direto entre as Partes

A Missão Cumprida cobra uma **Taxa de Conexão** de cada parte no momento em que uma proposta é aceita. A taxa é o preço do serviço de intermediação: quando paga pelos dois lados, a plataforma **libera o contato** (telefone, endereço completo e chat) entre CLIENTE e PRESTADOR.

- **Taxa do CLIENTE:** percentual sobre o valor da proposta aceita, exibido de forma transparente antes do pagamento;
- **Taxa do PRESTADOR:** percentual sobre o valor da proposta aceita, paga após a confirmação do pagamento do CLIENTE, dentro do prazo indicado no aplicativo;
- os **percentuais vigentes** (inclusive condições promocionais de lançamento) são exibidos no aplicativo e podem ser alterados pela plataforma mediante aviso, **sem efeito retroativo** sobre taxas já pagas;
- cada taxa possui um **valor mínimo**, divulgado no aplicativo;
- **repasse do meio de pagamento:** sobre a parcela da taxa paga via gateway incidem **4% (cartão)** ou **1% (Pix)**, exibidos no checkout antes da confirmação.

**O pagamento do serviço em si é realizado diretamente entre CLIENTE e PRESTADOR**, na forma que ambos combinarem. A plataforma **não custodia, não intermedeia e não garante** o pagamento do serviço, atuando exclusivamente na conexão entre as partes (Seções 1 e 2).

É expressamente **vedado combinar, solicitar ou aceitar a contratação por fora da plataforma** com o objetivo de evitar a Taxa de Conexão — a prática sujeita a conta a suspensão ou banimento (Seção 5).

## 5. Garantia de Conexão, Créditos, Cancelamentos e Banimentos

**Garantia de Conexão:** se, após o pagamento da taxa pelo CLIENTE, o PRESTADOR não pagar a taxa dele no prazo, cancelar ou não comparecer, a taxa paga pelo CLIENTE é **devolvida automaticamente como crédito** na plataforma, abatido na próxima taxa. O estorno pelo meio de pagamento original pode ser solicitado ao suporte e é processado manualmente.

**Direito de arrependimento (CDC art. 49):** o CLIENTE pode desistir **antes da liberação dos contatos**, com devolução integral da taxa em crédito (ou estorno mediante solicitação). Após a liberação dos contatos, o serviço de intermediação considera-se **integralmente prestado**.

**Regras de cancelamento e banimento**, aceitas expressamente por todos os usuários:

- CLIENTE que **cancelar após receber os dados do PRESTADOR** terá a conta **banida** da plataforma;
- PRESTADOR que **cancelar após receber os dados do CLIENTE**, ou que receber **reclamação de não comparecimento**, terá a conta **suspensa imediatamente** e **banida** após a confirmação da análise;
- qualquer das partes que agir com **má-fé para evitar o pagamento ou obter ressarcimento indevido** da Taxa de Conexão — incluindo propostas com valor artificialmente reduzido e combinação por fora — terá a conta **banida**;
- o banimento não afasta a apuração de responsabilidade civil ou criminal, quando cabível, e a plataforma poderá impedir novo cadastro sob outra identidade.

Em disputas sobre taxas, a Missão Cumprida atuará como mediadora, podendo ouvir as partes, solicitar provas e decidir, de forma justificada, pela devolução em crédito, estorno ou manutenção da cobrança. A decisão é **final e vinculante** para fins de uso da plataforma, sem prejuízo do acesso ao Poder Judiciário. **Nenhuma cláusula destes Termos afasta os direitos assegurados pelo Código de Defesa do Consumidor (Lei nº 8.078/1990)** na relação direta entre CLIENTE e PRESTADOR.

## 6. Serviço Diferente do Solicitado

Se, ao chegar ao local, o PRESTADOR identificar que o serviço efetivamente demandado é **diferente** daquele descrito no pedido aceito, ele **não deve executar o serviço** — deve **cancelar o atendimento** pelo aplicativo e, em seguida, comunicar a plataforma pelo canal de suporte. A plataforma analisará o caso e, se confirmada a inconformidade, **pagará ao PRESTADOR uma taxa de deslocamento**, a ser custeada pelo CLIENTE.

## 7. Cliente Ausente, Tempo de Espera e Taxa de Deslocamento

Se, no horário e local combinados, o CLIENTE não atender o PRESTADOR ou não estiver presente, o PRESTADOR deve **aguardar no local por, no mínimo, 15 (quinze) minutos**, registrando o atendimento pelo botão "Check-in" do aplicativo, com foto e geolocalização.

Decorrido esse prazo sem atendimento, o PRESTADOR pode cancelar o serviço pelo aplicativo **sem qualquer punição** e fará jus à devolução da sua Taxa de Conexão como crédito. A plataforma poderá ainda cobrar do CLIENTE uma **taxa de deslocamento e serviço não executado**, conforme a política comercial vigente, repassando-a ao PRESTADOR.

## 8. Prestador Ausente — Punições por Não Comparecimento

O **não comparecimento** do PRESTADOR a um serviço previamente confirmado (com contatos já liberados) é considerado falta grave e prejudica toda a comunidade. Conforme a Seção 5, a reclamação de não comparecimento resulta em **suspensão imediata** da conta e **banimento** após a confirmação da análise.

O PRESTADOR também perde a Taxa de Conexão paga e poderá ser obrigado a indenizar o CLIENTE por gastos comprovados (compra de materiais, perda de diária etc.), por decisão da mediação.

A Missão Cumprida pode, ainda, aplicar sanções adicionais em casos de fraude, conduta abusiva, assédio, discriminação ou qualquer comportamento que viole estes Termos ou a legislação vigente.

## 9. Conduta, Segurança e Privacidade

Os usuários comprometem-se a:

- tratar uns aos outros com respeito, civilidade e sem qualquer tipo de discriminação;
- não utilizar a plataforma para fins ilícitos, fraudulentos, abusivos ou contrários à moral e aos bons costumes;
- não solicitar nem oferecer serviços ilegais, perigosos ou que coloquem a integridade física de qualquer pessoa em risco;
- não tentar burlar a plataforma, formalizando acordos fora dela para evitar o pagamento das taxas — tal prática implica suspensão imediata da conta;
- proteger seus dados de acesso (e-mail e senha), sendo responsáveis por qualquer atividade realizada em sua conta;
- comunicar imediatamente o suporte em caso de suspeita de uso indevido da conta.

O tratamento dos dados pessoais segue a **Política de Privacidade** da plataforma, em conformidade com a LGPD. Você tem direito a solicitar acesso, correção, portabilidade e exclusão dos seus dados pelos canais oficiais.

## 10. Propriedade Intelectual

Todos os elementos da plataforma (marca, logotipos, código, design, banco de categorias) são de **propriedade exclusiva** da Missão Cumprida, ficando vedada a reprodução, cópia, engenharia reversa ou uso sem autorização expressa.

## 11. Alterações dos Termos

Estes Termos podem ser atualizados a qualquer momento. Mudanças relevantes serão comunicadas no aplicativo e, quando exigirem nova aceitação, o usuário será impedido de utilizar a plataforma até manifestar concordância com a nova versão.

## 12. Foro e Legislação Aplicável

Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o **foro da Comarca de Lajeado/RS** para dirimir qualquer controvérsia, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

---

Ao marcar a caixa "Li e aceito" e clicar em "Aceitar", você declara que leu integralmente estes Termos, está plenamente ciente das suas disposições e concorda em vincular-se a todas as regras aqui estabelecidas. **Esta aceitação é registrada com data, hora e IP de origem, e tem força de assinatura eletrônica nos termos do art. 10, §2º, da MP 2.200-2/2001.**
`.trim(),
}

export const PRIVACY_FALLBACK = {
  title: 'Política de Privacidade',
  effective_date: '2026-10-24',
  body: `
_Última atualização: 24/10/2026._

Esta Política de Privacidade descreve como a **Missão Cumprida** ("nós", "plataforma") coleta, usa, compartilha e protege os dados pessoais dos usuários ("você"), em conformidade com a **Lei Geral de Proteção de Dados — LGPD (Lei nº 13.709/2018)**.

## 1. Controlador dos dados

O controlador dos dados é **[RAZÃO SOCIAL]**, inscrita no CNPJ nº **[CNPJ]**, com sede em **[ENDEREÇO COMPLETO]**.

**Encarregado (DPO):** **[NOME DO ENCARREGADO]** — contato: **[E-MAIL DO ENCARREGADO/DPO]**.

## 2. Dados que coletamos

**a) Dados de cadastro:** nome, e-mail, telefone, senha (armazenada de forma criptografada), papel (cliente/prestador).

**b) Dados de perfil e cobrança:** CPF (identifica a conta — cada CPF pode ter apenas uma conta), endereço, chave PIX, foto de avatar, biografia.

**c) Verificação de identidade (KYC):** foto de documento oficial e **selfie** (dado biométrico), utilizados para conferência de identidade e prevenção a fraudes. Trata-se de **dado pessoal sensível** (LGPD art. 11).

**d) Dados de localização:** localização aproximada e/ou precisa (GPS), usada para encontrar prestadores/pedidos por região e para o **check-in e a conclusão do serviço com foto e geolocalização**. O **local exato do serviço** é informado por você no pedido — pelo GPS, quando você confirma que está no local, ou pelo endereço digitado convertido em coordenadas — e só é revelado ao prestador depois que as duas taxas de conexão forem pagas; antes disso ele vê apenas o bairro, a cidade e um ponto aproximado.

**d.1) Fotos:** as fotos enviadas nos pedidos, no check-in e na conclusão do serviço têm os metadados do arquivo (inclusive a localização gravada pelo celular) removidos antes de serem guardadas.

**e) Conteúdo gerado:** pedidos, propostas, mensagens de chat, avaliações, fotos do serviço.

**f) Dados financeiros/transacionais:** valores, taxas, status de pagamento e saques. **Não armazenamos os dados completos do cartão** — eles são processados diretamente pelos provedores de pagamento.

**g) Dados técnicos/de uso:** identificadores do dispositivo, tokens de notificação push, logs de acesso e endereço IP.

## 3. Finalidades e bases legais (LGPD art. 7º e 11)

| Finalidade | Base legal |
|---|---|
| Criar e gerenciar sua conta; operar o serviço | Execução de contrato (art. 7º, V) |
| Verificação de identidade (KYC) e prevenção a fraudes | Cumprimento de obrigação legal / legítimo interesse / proteção ao crédito; para dado biométrico: consentimento e prevenção à fraude (art. 11) |
| Processar o pagamento das Taxas de Conexão e da assinatura Verificado Pro | Execução de contrato |
| Localização para conectar oferta e demanda e comprovar execução | Execução de contrato e consentimento (permissão do sistema) |
| Enviar notificações sobre pedidos, propostas e pagamentos | Execução de contrato / legítimo interesse |
| Segurança, auditoria e cumprimento de obrigações legais | Obrigação legal / legítimo interesse |

## 4. Compartilhamento de dados

Compartilhamos dados **apenas na medida do necessário** com:

- **Provedor de pagamento:** Mercado Pago (PIX/cartão), como operador — usado para a cobrança das Taxas de Conexão;
- **Gestão de assinaturas (loja de aplicativos):** RevenueCat e Google Play, para o Selo Verificado Pro;
- **Serviços de notificação:** provedores de push (Expo/Google);
- **Provedor de hospedagem e banco de dados** onde a aplicação é executada;
- **Autoridades públicas**, mediante requisição legal.

Os documentos e a selfie de KYC **não são exibidos a outros usuários** nem comercializados.

## 5. Transferência internacional

Alguns provedores (ex.: RevenueCat, serviços de push) podem processar dados **fora do Brasil**. Nesses casos, adotamos salvaguardas compatíveis com a LGPD (art. 33).

## 6. Retenção

Mantemos os dados pelo tempo necessário às finalidades e ao cumprimento de obrigações legais. As **imagens de KYC** são mantidas por até **5 (cinco) anos** após o encerramento da conta, ressalvadas obrigações legais de retenção. Dados financeiros seguem os prazos fiscais aplicáveis.

**CPF após a exclusão ou banimento:** guardamos apenas um **código irreversível (hash criptográfico) do CPF**, sem nome nem contato, com a única finalidade de impedir um novo cadastro com o mesmo CPF (prevenção a fraudes e proteção da comunidade — LGPD art. 7º, IX, e art. 10). O titular pode pedir a revisão desse bloqueio pelo suporte.

**Registros de atividade:** os registros de acesso (data, hora e IP) são guardados por no mínimo 6 (seis) meses (Marco Civil da Internet, art. 15). Os registros de pedidos, pagamentos, estornos, cancelamentos, conversas e atendimentos são mantidos por até 5 (cinco) anos, para responder reclamações, apurar fraudes e cumprir obrigações legais (Código de Defesa do Consumidor e legislação fiscal).

## 7. Seus direitos (LGPD art. 18)

Você pode, a qualquer momento, solicitar: confirmação e acesso; correção; anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade; informação sobre compartilhamento; e revogação de consentimento.

## 8. Exclusão da conta e dos dados

Você pode **excluir sua conta** diretamente no aplicativo (menu **Perfil → Excluir conta**) ou pela web, e ainda solicitar exclusão pelos canais oficiais. Ao excluir, seus dados pessoais são **anonimizados**; alguns registros financeiros/transacionais podem ser retidos de forma anonimizada por obrigação legal/fiscal.

Página pública de solicitação de exclusão: **/exclusao-de-conta** (no site da Missão Cumprida).

## 9. Segurança

Adotamos medidas técnicas e organizacionais (criptografia de senhas, controle de acesso a documentos sensíveis, HTTPS, limitação de acesso) para proteger seus dados.

## 10. Crianças e adolescentes

A plataforma destina-se a **maiores de 18 anos**. Não coletamos intencionalmente dados de menores.

## 11. Alterações

Podemos atualizar esta Política. Mudanças relevantes serão comunicadas no aplicativo.

## 12. Contato

Dúvidas ou solicitações: **[E-MAIL DE CONTATO]** / Encarregado (DPO): **[E-MAIL DO ENCARREGADO/DPO]**.
`.trim(),
}
