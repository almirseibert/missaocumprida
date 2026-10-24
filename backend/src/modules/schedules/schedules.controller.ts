import { Request, Response } from 'express'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import * as R from '../../utils/response'
import { sendToUser, PushChannel } from '../push/push.service'
import { persistUpload } from '../files/files.service'
import { computeHoldUntil } from '../payments/payments.service'
import { contactsUnlocked, unlockedOrderWhere } from '../../utils/orderVisibility'
import {
  creditFee,
  cancelPendingFeesForProposal,
  reopenOrderFromBrokenMatch,
} from '../payments/connectionFees.service'
import { banUser, suspendUserForReview } from '../users/moderation.service'
import { getSettings } from '../settings/settings.service'
import { cancelBeforeConnectionByClient } from './scheduleCancel.service'

/** Arquivos enviados nos campos "photo" (app antigo) e "photos" (vários). */
function collectServicePhotos(req: Request): Express.Multer.File[] {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined
  if (!files) return req.file ? [req.file] : []
  return [...(files.photo ?? []), ...(files.photos ?? [])]
}

function parseCoord(v: unknown, limit: number): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = parseFloat(String(v))
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null
}

const scheduleInclude = {
  order: {
    include: {
      category: { select: { id: true, name: true, icon: true } },
    },
  },
  provider: { select: { id: true, name: true, avatar: true, phone: true, rating_avg: true, hourly_rate: true } },
  client: { select: { id: true, name: true, avatar: true, phone: true, rating_avg: true } },
  ratings: { select: { id: true, score: true, reviewer_role: true, reviewer_id: true } },
}

// Sinaliza, dentro de uma transação, que o estado mudou entre a leitura e a escrita.
class ScheduleStateChanged extends Error {}

// Helper: create in-app notification + send push
async function notify(
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: object,
  channel: PushChannel = 'schedule_update'
) {
  try {
    await prisma.notification.create({
      data: { user_id: userId, type: type as never, title, body, data: data ?? undefined },
    })
  } catch (err) {
    console.error('[notify] db error:', err)
  }
  await sendToUser(userId, { title, body, data: data as any, channel })
}

// Taxa de Conexão: telefone das partes só aparece depois que as duas taxas
// foram pagas (pedido SCHEDULED+). Antes disso, o cliente veria o telefone do
// prestador logo no aceite — este helper anula os campos na resposta.
function maskScheduleContacts<
  T extends {
    order?: { status?: string; provider_fee_paid_at?: Date | null } | null
    provider?: { phone?: string | null } | null
    client?: { phone?: string | null } | null
  },
>(schedule: T): T {
  if (contactsUnlocked(schedule.order?.status, schedule.order?.provider_fee_paid_at)) return schedule
  return {
    ...schedule,
    provider: schedule.provider ? { ...schedule.provider, phone: null } : schedule.provider,
    client: schedule.client ? { ...schedule.client, phone: null } : schedule.client,
  }
}

export async function listMySchedules(req: Request, res: Response) {
  const { status } = req.query
  const where: Record<string, unknown> = {
    OR: [
      { client_id: req.userId },
      // Provider only sees schedules once both fees are paid (SCHEDULED or beyond)
      {
        provider_id: req.userId,
        order: unlockedOrderWhere() as any,
      },
    ],
  }
  if (status) where.status = status

  const schedules = await prisma.schedule.findMany({
    where,
    orderBy: { scheduled_at: 'asc' },
    include: scheduleInclude,
  })
  return R.ok(res, schedules.map(maskScheduleContacts))
}

export async function getSchedule(req: Request, res: Response) {
  const found = await prisma.schedule.findUnique({
    where: { id: req.params.id },
    // As 50 mensagens MAIS RECENTES (antes vinham as 50 mais antigas e o
    // restante da conversa sumia); devolvidas em ordem cronológica.
    include: { ...scheduleInclude, messages: { orderBy: { created_at: 'desc' }, take: 50 } },
  })
  const schedule = found ? { ...found, messages: [...found.messages].reverse() } : null
  if (!schedule) return R.notFound(res, 'Agendamento não encontrado')
  if (schedule.client_id !== req.userId && schedule.provider_id !== req.userId) {
    return R.forbidden(res)
  }
  // Provider can only access the schedule after both fees are paid
  if (
    schedule.provider_id === req.userId &&
    schedule.client_id !== req.userId &&
    !contactsUnlocked(schedule.order?.status, schedule.order?.provider_fee_paid_at)
  ) {
    return R.notFound(res, 'Agendamento não encontrado')
  }
  const service_photos = await prisma.orderPhoto.findMany({
    where: { schedule_id: schedule.id },
    orderBy: { created_at: 'asc' },
    select: { id: true, stage: true, url: true, latitude: true, longitude: true, created_at: true },
  })
  return R.ok(res, { ...maskScheduleContacts(schedule), service_photos })
}

export async function checkin(req: Request, res: Response) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: req.params.id },
    include: { order: { select: { status: true, provider_fee_paid_at: true } } },
  })
  if (!schedule) return R.notFound(res, 'Agendamento não encontrado')
  if (schedule.provider_id !== req.userId) return R.forbidden(res)
  if (schedule.status !== 'CONFIRMED') return R.badRequest(res, 'Check-in não permitido neste estágio')
  // Taxa de Conexão: o serviço só pode começar depois que as DUAS taxas foram
  // pagas (pedido SCHEDULED). Sem isso, o check-in levaria o pedido a
  // IN_PROGRESS e liberaria endereço/telefone/chat sem pagamento.
  if (
    schedule.order.status !== 'SCHEDULED' ||
    !contactsUnlocked(schedule.order.status, schedule.order.provider_fee_paid_at)
  ) {
    return R.forbidden(res, 'O check-in só é liberado depois que as taxas de conexão forem pagas.')
  }

  const files = collectServicePhotos(req)
  if (files.length === 0) return R.badRequest(res, 'Envie ao menos uma foto do início do serviço')
  const s = await getSettings()
  if (files.length > s.max_service_photos) return R.badRequest(res, `Envie no máximo ${s.max_service_photos} fotos`)

  const lat = parseCoord(req.body.lat, 90)
  const lng = parseCoord(req.body.lng, 180)
  const address = typeof req.body.address === 'string' ? req.body.address.slice(0, 300) : null

  const photoUrls: string[] = []
  for (const f of files) photoUrls.push(await persistUpload(req, f, { ownerId: req.userId }))
  const photoUrl = photoUrls[0]

  // Transição condicional: evita corrida entre dois check-ins e garante que o
  // pedido ainda está SCHEDULED no momento da escrita.
  const updated = await prisma.$transaction(async (tx) => {
    const orderMoved = await tx.order.updateMany({
      where: { id: schedule.order_id, status: 'SCHEDULED' },
      data: { status: 'IN_PROGRESS' },
    })
    const scheduleMoved = await tx.schedule.updateMany({
      where: { id: schedule.id, status: 'CONFIRMED' },
      data: {
        status: 'IN_PROGRESS',
        checkin_at: new Date(),
        checkin_photo_url: photoUrl,
        checkin_lat: lat,
        checkin_lng: lng,
        checkin_address: address,
      },
    })
    if (orderMoved.count === 0 || scheduleMoved.count === 0) {
      throw new ScheduleStateChanged()
    }
    await tx.orderPhoto.createMany({
      data: photoUrls.map((url) => ({
        order_id: schedule.order_id,
        schedule_id: schedule.id,
        stage: 'CHECKIN' as const,
        url,
        uploaded_by: req.userId,
        latitude: lat,
        longitude: lng,
      })),
    })
    return tx.schedule.findUnique({ where: { id: schedule.id } })
  }).catch((err) => {
    if (err instanceof ScheduleStateChanged) return null
    throw err
  })
  if (!updated) return R.conflict(res, 'O agendamento mudou de estado. Atualize a tela e tente novamente.')

  // Notify client
  await notify(
    schedule.client_id,
    'CHECKIN_DONE',
    'Prestador iniciou o serviço',
    'O prestador realizou o check-in e o serviço está em andamento.',
    { schedule_id: schedule.id },
  )

  return R.ok(res, updated, 'Check-in realizado com sucesso')
}

export async function completeByProvider(req: Request, res: Response) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: req.params.id },
    include: {
      provider: { select: { hourly_rate: true } },
      order: { select: { status: true, provider_fee_paid_at: true } },
    },
  })
  if (!schedule) return R.notFound(res, 'Agendamento não encontrado')
  if (schedule.provider_id !== req.userId) return R.forbidden(res)
  if (schedule.status !== 'IN_PROGRESS') return R.badRequest(res, 'Serviço ainda não foi iniciado (check-in)')
  if (!contactsUnlocked(schedule.order.status, schedule.order.provider_fee_paid_at)) {
    return R.forbidden(res, 'As taxas de conexão deste pedido ainda não foram pagas.')
  }

  const files = collectServicePhotos(req)
  if (files.length === 0) return R.badRequest(res, 'Envie ao menos uma foto do serviço concluído')
  const s = await getSettings()
  if (files.length > s.max_service_photos) return R.badRequest(res, `Envie no máximo ${s.max_service_photos} fotos`)
  if (schedule.done_at) return R.badRequest(res, 'Este serviço já foi marcado como concluído')

  const lat = parseCoord(req.body.lat, 90)
  const lng = parseCoord(req.body.lng, 180)
  const address = typeof req.body.address === 'string' ? req.body.address.slice(0, 300) : null

  // Calculate duration and hourly amount
  let durationMinutes: number | null = null
  let hourlyAmount: number | null = null
  if (schedule.checkin_at) {
    durationMinutes = Math.round((Date.now() - schedule.checkin_at.getTime()) / 60000)
    const rate = schedule.provider?.hourly_rate ?? null
    if (rate) {
      hourlyAmount = Math.round((durationMinutes / 60) * rate * 100) / 100
    }
  }

  const photoUrls: string[] = []
  for (const f of files) photoUrls.push(await persistUpload(req, f, { ownerId: req.userId }))

  await prisma.$transaction([
    prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        done_at: new Date(),
        complete_photo_url: photoUrls[0],
        complete_lat: lat,
        complete_lng: lng,
        complete_address: address,
        duration_minutes: durationMinutes,
        hourly_amount: hourlyAmount,
      },
    }),
    prisma.orderPhoto.createMany({
      data: photoUrls.map((url) => ({
        order_id: schedule.order_id,
        schedule_id: schedule.id,
        stage: 'COMPLETION' as const,
        url,
        uploaded_by: req.userId,
        latitude: lat,
        longitude: lng,
      })),
    }),
  ])

  // Notify client
  await notify(
    schedule.client_id,
    'SERVICE_COMPLETED',
    'Serviço concluído pelo prestador',
    'O prestador marcou o serviço como concluído. Confirme para liberar o pagamento.',
    { schedule_id: schedule.id },
  )

  return R.ok(res, { duration_minutes: durationMinutes, hourly_amount: hourlyAmount }, 'Serviço marcado como concluído. Aguardando confirmação do cliente.')
}

// ---------------------------------------------------------------------------
// POST /api/schedules/:id/cancel — cancelamento com as regras da Taxa de Conexão
// Pré-liberação: sem punição (taxas pagas voltam como crédito).
// Pós-liberação (contatos revelados): quem cancela é BANIDO (Termos de Uso) e
// a taxa da outra parte volta como crédito.
// ---------------------------------------------------------------------------
export async function cancelSchedule(req: Request, res: Response) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: req.params.id },
    include: { order: { include: { connection_fees: true } } },
  })
  if (!schedule) return R.notFound(res, 'Agendamento não encontrado')

  const isClient = schedule.client_id === req.userId
  const isProvider = schedule.provider_id === req.userId
  if (!isClient && !isProvider) return R.forbidden(res)
  if (schedule.status !== 'CONFIRMED') {
    return R.badRequest(res, 'Este agendamento não pode mais ser cancelado (o serviço já iniciou ou foi concluído)')
  }

  const order = schedule.order
  const clientFee = order.connection_fees.find((f) => f.side === 'CLIENT')
  const providerFee = order.connection_fees.find((f) => f.side === 'PROVIDER')
  const unlocked = contactsUnlocked(order.status, order.provider_fee_paid_at)

  // ---- Pré-liberação (janela ACCEPTED): sem punição ----
  if (!unlocked) {
    if (isClient) {
      const result = await cancelBeforeConnectionByClient(schedule.id, req.userId)
      if (!result.ok) return R.conflict(res, result.message)
      return R.ok(res, null, result.message)
    }

    // Prestador desiste antes da conexão: cliente recreditado, pedido reabre
    await cancelPendingFeesForProposal(schedule.proposal_id)
    await reopenOrderFromBrokenMatch(order.id, schedule.proposal_id, 'PROVIDER_CANCELLED_BEFORE_CONNECTION')
    if (clientFee) await creditFee(clientFee, 'PROVIDER_CANCELLED')
    await prisma.user.update({
      where: { id: schedule.provider_id },
      data: { no_show_count: { increment: 1 } },
    })
    await notify(schedule.client_id, 'GENERAL', 'O profissional desistiu 😕',
      'O prestador cancelou antes da conexão. Sua taxa voltou como crédito — escolha outra proposta.', { order_id: order.id })
    return R.ok(res, null, 'Proposta cancelada. O pedido voltou para a fila do cliente.')
  }

  // ---- Pós-liberação: cancelou depois de receber os dados = banimento ----
  if (isClient) {
    if (providerFee) await creditFee(providerFee, 'CLIENT_CANCELLED')
    await prisma.$transaction([
      prisma.schedule.update({ where: { id: schedule.id }, data: { status: 'CANCELLED' } }),
      prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } }),
    ])
    await notify(schedule.provider_id, 'GENERAL', 'Serviço cancelado pelo cliente',
      'O cliente cancelou após a conexão. Sua taxa voltou como crédito e a conta dele foi banida conforme os Termos.', { order_id: order.id })
    await banUser(schedule.client_id, 'Cancelamento após receber os dados do prestador (Termos de Uso)')
    return R.ok(res, null, 'Serviço cancelado. Conforme os Termos de Uso, contas que cancelam após receber os dados do profissional são banidas.')
  }

  if (clientFee) await creditFee(clientFee, 'PROVIDER_CANCELLED')
  await prisma.user.update({
    where: { id: schedule.provider_id },
    data: { no_show_count: { increment: 1 } },
  })
  await reopenOrderFromBrokenMatch(order.id, schedule.proposal_id, 'PROVIDER_CANCELLED_AFTER_CONNECTION')
  await notify(schedule.client_id, 'GENERAL', 'O profissional cancelou 😕',
    'O prestador cancelou após a conexão e foi banido conforme os Termos. Sua taxa voltou como crédito — escolha outra proposta.', { order_id: order.id })
  await banUser(schedule.provider_id, 'Cancelamento após receber os dados do cliente (Termos de Uso)')
  return R.ok(res, null, 'Serviço cancelado. Conforme os Termos de Uso, profissionais que cancelam após receber os dados do cliente são banidos.')
}

// ---------------------------------------------------------------------------
// POST /api/schedules/:id/report-no-show — cliente reporta que o prestador
// não compareceu. Recredita o cliente, reabre o pedido e SUSPENDE o prestador
// para análise do admin (que confirma o ban ou reverte).
// ---------------------------------------------------------------------------
export async function reportNoShow(req: Request, res: Response) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: req.params.id },
    include: { order: { include: { connection_fees: true } } },
  })
  if (!schedule) return R.notFound(res, 'Agendamento não encontrado')
  if (schedule.client_id !== req.userId) return R.forbidden(res)

  const order = schedule.order
  if (!contactsUnlocked(order.status, order.provider_fee_paid_at)) {
    return R.badRequest(res, 'A conexão ainda não foi concluída — cancele o agendamento se necessário')
  }
  if (schedule.status !== 'CONFIRMED') {
    return R.badRequest(res, 'O serviço já foi iniciado ou concluído — abra um chamado no suporte')
  }
  if (schedule.scheduled_at.getTime() > Date.now()) {
    return R.badRequest(res, 'Só é possível reportar não comparecimento após o horário agendado')
  }

  const clientFee = order.connection_fees.find((f) => f.side === 'CLIENT')
  if (clientFee) await creditFee(clientFee, 'PROVIDER_NOSHOW')
  await prisma.user.update({
    where: { id: schedule.provider_id },
    data: { no_show_count: { increment: 1 } },
  })
  await reopenOrderFromBrokenMatch(order.id, schedule.proposal_id, 'PROVIDER_NO_SHOW')
  await suspendUserForReview(
    schedule.provider_id,
    `No-show reportado pelo cliente no pedido ${order.id} — em análise para banimento (Termos de Uso)`,
  )

  return R.ok(res, null,
    'Não comparecimento registrado. Sua taxa voltou como crédito, o pedido reabriu e o profissional foi suspenso para análise.')
}

export async function confirmByClient(req: Request, res: Response) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: req.params.id },
    include: { order: { include: { payment: true } } },
  })
  if (!schedule) return R.notFound(res, 'Agendamento não encontrado')
  if (schedule.client_id !== req.userId) return R.forbidden(res)
  if (!schedule.done_at) return R.badRequest(res, 'O prestador ainda não marcou o serviço como concluído')
  if (schedule.status !== 'IN_PROGRESS') return R.badRequest(res, 'Confirmação não permitida neste estágio')
  if (!contactsUnlocked(schedule.order.status, schedule.order.provider_fee_paid_at)) {
    return R.forbidden(res, 'As taxas de conexão deste pedido ainda não foram pagas.')
  }

  const payment = schedule.order.payment

  // Segurança de Transação: o valor pago NÃO é liberado na hora. Entra em
  // garantia (HELD) por TRANSACTION_HOLD_DAYS dias e só vira saldo sacável do
  // prestador após análise/aprovação de um admin. Isso preserva uma janela
  // legal para reclamação e possível reembolso, mesmo com o aceite do cliente.
  const now = new Date()
  const holdUntil = computeHoldUntil(now)
  const goesToHold = !!payment && payment.status === 'PAID'

  const ops = [
    prisma.schedule.update({ where: { id: schedule.id }, data: { status: 'DONE' } }),
    prisma.order.update({ where: { id: schedule.order_id }, data: { status: 'DONE' } }),
    ...(goesToHold
      ? [
          prisma.payment.update({
            where: { id: payment!.id },
            data: { status: 'HELD', confirmed_at: now, hold_until: holdUntil },
          }),
        ]
      : []),
  ]

  await prisma.$transaction(ops)

  // Notify provider — valor em garantia (não liberado ainda)
  await notify(
    schedule.provider_id,
    'SERVICE_CONFIRMED',
    'Serviço confirmado pelo cliente',
    goesToHold
      ? `R$ ${(payment?.provider_amount ?? 0).toFixed(2)} entraram em garantia (Segurança de Transação) e serão liberados após análise, em até ${env.TRANSACTION_HOLD_DAYS} dias.`
      : 'O cliente confirmou a conclusão do serviço.',
    { schedule_id: schedule.id, payment_id: payment?.id, hold_until: goesToHold ? holdUntil.toISOString() : undefined },
    'schedule_update',
  )

  return R.ok(
    res,
    null,
    `Serviço confirmado! O pagamento entrou em garantia (Segurança de Transação) e será liberado ao prestador após análise, em até ${env.TRANSACTION_HOLD_DAYS} dias. Agora avalie o serviço.`,
  )
}
