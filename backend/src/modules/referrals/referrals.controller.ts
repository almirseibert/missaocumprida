import { Request, Response } from 'express'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'
import { ensureReferralCode, REFERRAL_THRESHOLD } from './referrals.service'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

// GET /api/referrals/my-code
export async function getMyCode(req: Request, res: Response) {
  const code = await ensureReferralCode(req.userId!)

  const [events, stats, user] = await Promise.all([
    prisma.referralEvent.findMany({
      where: { referrer_id: req.userId },
      orderBy: { created_at: 'desc' },
      take: 20,
      select: {
        id: true, status: true, created_at: true, completed_at: true,
        referrer_reward: true, referred_reward: true, qualifying_volume: true,
        referred: { select: { id: true, name: true, avatar: true } },
      },
    }),
    prisma.referralEvent.groupBy({
      by: ['status'],
      where: { referrer_id: req.userId },
      _count: { _all: true },
    }),
    prisma.user.findUnique({
      where: { id: req.userId },
      select: { credit_balance: true },
    }),
  ])

  const pending = stats.find((s) => s.status === 'PENDING')?._count._all ?? 0
  const completed = stats.find((s) => s.status === 'COMPLETED')?._count._all ?? 0

  return R.ok(res, {
    code,
    share_url: `${FRONTEND_URL}/convite/${code}`,
    deep_link: `missaocumprida://convite/${code}`,
    credit_balance: user?.credit_balance ?? 0,
    threshold: REFERRAL_THRESHOLD,
    stats: { pending, completed, total: pending + completed },
    events,
  })
}

// GET /api/referrals/events
export async function listEvents(req: Request, res: Response) {
  const events = await prisma.referralEvent.findMany({
    where: { referrer_id: req.userId },
    orderBy: { created_at: 'desc' },
    select: {
      id: true, status: true, created_at: true, completed_at: true,
      referrer_reward: true, referred_reward: true,
      referred: { select: { id: true, name: true, avatar: true } },
    },
  })
  return R.ok(res, events)
}

// GET /api/referrals/credits
export async function listCreditTransactions(req: Request, res: Response) {
  const [txs, user] = await Promise.all([
    prisma.creditTransaction.findMany({
      where: { user_id: req.userId },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
    prisma.user.findUnique({
      where: { id: req.userId },
      select: { credit_balance: true },
    }),
  ])
  return R.ok(res, { balance: user?.credit_balance ?? 0, transactions: txs })
}

// GET /api/referrals/lookup/:code — endpoint público para verificar código
export async function lookupCode(req: Request, res: Response) {
  const code = req.params.code.toUpperCase()
  const u = await prisma.user.findUnique({
    where: { referral_code: code },
    select: { name: true, avatar: true },
  })
  if (!u) return R.notFound(res, 'Código inválido')
  return R.ok(res, { name: u.name, avatar: u.avatar, code })
}
