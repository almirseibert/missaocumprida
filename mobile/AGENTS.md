# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

---

# Guia de manutenção do mobile

Stack: Expo SDK 56 · React Native 0.85 (Hermes) · React 19 · expo-router · NativeWind v4 · Zustand · Axios.

## 1. Hermes NÃO suporta a API `Intl`

O motor JS (Hermes) desta versão não implementa `Intl` de forma completa.
Chamar `new Intl.NumberFormat(...).format()`, `Intl.DateTimeFormat`, `Number.toLocaleString`,
`Date.toLocaleDateString/toLocaleTimeString` lança em runtime: **`TypeError: undefined is not a function`**
(o método `.format` vem `undefined`). O erro aparece na PRIMEIRA tela que chama a função.

➡️ Use sempre os formatadores manuais em [src/lib/utils.ts](src/lib/utils.ts):
`formatCurrency`, `formatDate`, `formatDateShort`, `formatTime`. Nunca reintroduza `Intl`/`toLocale*`.

## 2. Formato das respostas da API (envelope + array vs objeto)

Toda resposta do backend usa o envelope `{ success, message, data }`.
No mobile sempre lê-se `res.data.data`.

⚠️ **Armadilha mais comum de crash:** o código faz `.map`/`.filter` em `res.data.data`
esperando um **array**, mas o backend devolve um **objeto**. Isso gera
`undefined is not a function` (em `.map`) ou listas vazias silenciosas (em `FlatList`).

Formatos reais por endpoint (conferidos no `backend/src/modules/*`):

| Endpoint (mobile)                 | `data.data` retornado                          | Como ler no mobile                          |
|-----------------------------------|------------------------------------------------|---------------------------------------------|
| `GET /categories/groups`          | **array** de grupos                            | direto                                      |
| `GET /categories/:slug`           | objeto categoria                               | direto                                      |
| `GET /categories/:slug/questionnaire` | objeto categoria com **`questionnaire_fields`** | `data.questionnaire_fields` (NÃO é array)   |
| `GET /orders`                     | objeto **`{ orders, total, page, limit }`**    | `data.orders`                               |
| `GET /orders/feed`                | objeto **`{ orders, total, page, limit, ... }`** | `data.orders`                             |
| `GET /orders/:id`                 | objeto pedido                                  | direto                                      |
| `GET /orders/:id/proposals`       | **array** de propostas                         | direto                                      |
| `GET /schedules`                  | **array** de agendamentos                      | direto                                      |
| `GET /schedules/:id`              | objeto agendamento                             | direto                                      |
| `GET /schedules/:id/messages`     | **array** de mensagens                         | direto                                      |
| `GET /payments/my-balance`        | objeto `{ available_balance, pix_key, pix_key_type, recent_withdrawals, ... }` | direto |
| `GET /payments/order/:orderId`    | objeto pagamento                               | direto                                      |
| `POST /payments/create-checkout`  | objeto `{ pix_code, pix_qr_base64, base_amount, gateway_fee, amount, dev_mode, already_paid }` | direto |
| `GET /users/me`                   | objeto usuário                                 | direto                                      |

Ainda NÃO consumidos pelo mobile, mas também aninham (atenção se forem usados):
`GET /notifications` → `{ notifications, unread }` · `GET /ratings/...` → `{ ratings, total }`.

➡️ Padrão defensivo recomendado ao consumir listas que podem vir aninhadas:
```ts
const d = res.data.data
setItems(Array.isArray(d) ? d : (d?.orders ?? []))
```

## 3. Outras observações

- `EXPO_PUBLIC_API_URL` (em `.env`) deve apontar para o IP da máquina na rede local
  (ex.: `http://192.168.x.x:3333`), nunca `localhost`, senão o app no emulador/dispositivo não acessa o backend.
- Ao mudar `src/lib/*` ou qualquer transform, reinicie o Metro com cache limpo: `npx expo start -c`.
  Bundle "rebuildado" pode ainda servir transform antigo em cache e mascarar correções.
- Diferença de nomes: backend usa `is_read` em mensagens; o tipo do mobile tem `read` (não usado em render).
