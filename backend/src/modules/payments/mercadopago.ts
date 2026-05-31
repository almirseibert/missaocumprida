import { MercadoPagoConfig, Payment } from 'mercadopago'
import { env } from '../../config/env'

export const mpClient = new MercadoPagoConfig({
  accessToken: env.MP_ACCESS_TOKEN,
})

export const mpPayment = new Payment(mpClient)
