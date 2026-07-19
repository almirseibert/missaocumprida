import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'
import { env } from '../../config/env'

export const mpClient = new MercadoPagoConfig({
  accessToken: env.MP_ACCESS_TOKEN,
})

export const mpPayment = new Payment(mpClient)

// Checkout Pro (preference → init_point) — usado para pagamento com cartão
// sem lidar com dados de cartão no nosso backend (sem escopo PCI).
export const mpPreference = new Preference(mpClient)
