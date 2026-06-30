'use strict'
// ============================================================================
// Simulação de marketplace baseada em agentes — Missão Cumprida
// 50+ clientes e 50+ prestadores heterogêneos interagindo mês a mês.
// Modela as forças reais que fazem um marketplace de dois lados prosperar OU
// entrar em espiral: cold start / liquidez, conversão, qualidade/disputa,
// churn por inatividade, sensibilidade à taxa, vazamento (desintermediação)
// e crescimento (orgânico + marketing + indicação). Saída: trajetória de KPIs
// e de um "índice de expectativa" (0–100), em 3 cenários, via Monte Carlo.
// ============================================================================

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
function rnd(rng, lo, hi) { return lo + (hi - lo) * rng() }
function rndint(rng, lo, hi) { return Math.floor(rnd(rng, lo, hi + 1)) }
function poisson(rng, lambda) { // Knuth
  const L = Math.exp(-lambda); let k = 0, p = 1
  do { k++; p *= rng() } while (p > L)
  return k - 1
}
function median(arr) { const a = [...arr].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2 }
function pct(arr, q) { const a = [...arr].sort((x, y) => x - y); const i = clamp(Math.round(q * (a.length - 1)), 0, a.length - 1); return a[i] }

const N_REGIONS = 4
const N_CATS = 10
const CAT_BASE = [150, 200, 220, 120, 400, 180, 150, 90, 120, 100] // R$ por categoria

function pickCats(rng) {
  const n = rndint(rng, 1, 3); const s = new Set()
  while (s.size < n) s.add(rndint(rng, 0, N_CATS - 1))
  return [...s]
}

function makeClient(rng) {
  return {
    region: rndint(rng, 0, N_REGIONS - 1),
    cats: pickCats(rng),
    demand: rnd(rng, 0.2, 1.0),          // serviços/mês esperados
    priceSens: rnd(rng, 0.0, 1.0),
    trustThr: rnd(rng, 3.4, 4.6),        // nota mínima que dá conforto
    tech: rnd(rng, 0.3, 1.0),            // afinidade com app vs WhatsApp
    refProp: rnd(rng, 0.0, 0.4),
    sat: 0.6, active: true, noService: 0, success: 0,
  }
}
function makeProvider(rng) {
  return {
    region: rndint(rng, 0, N_REGIONS - 1),
    cats: pickCats(rng),
    quality: rnd(rng, 0.4, 0.98),
    capacity: rndint(rng, 2, 8),         // jobs/mês
    priceLevel: rnd(rng, 0.85, 1.25),
    feeTol: rnd(rng, 0.08, 0.30),
    responsiveness: rnd(rng, 0.30, 0.90),
    refProp: rnd(rng, 0.0, 0.35),
    ratingSum: 0, ratingN: 0, jobs: 0, idle: 0, earnings: 0, active: true,
  }
}

function baseParams() {
  return {
    months: 12, startClients: 50, startProviders: 50,
    clientOrganic: 0.06, providerOrganic: 0.035,
    marketingClients: 8, marketingProviders: 4,
    referralStrength: 0.45,
    takeRate: 0.20,            // receita total da plataforma sobre o GMV
    providerSideFee: 0.10,     // taxa "sentida" pelo prestador
    coldStartTrust: 0.50,      // conversão de prestador sem avaliações
    leakage: 0.24,             // desintermediação de relações recorrentes
    disputeBase: 0.04,
    clientPatience: 2, clientChurn: 0.5,
    providerIdlePatience: 2, providerChurn: 0.45,
    convBase: 0.62,
    maxClients: 4000, maxProviders: 2500,
  }
}

function runSim(P, seed) {
  const rng = mulberry32(seed)
  const clients = [], providers = []
  for (let i = 0; i < P.startClients; i++) clients.push(makeClient(rng))
  for (let i = 0; i < P.startProviders; i++) providers.push(makeProvider(rng))

  const hist = []
  let prevGMV = 0

  for (let m = 0; m < P.months; m++) {
    const activeClients0 = clients.filter((c) => c.active)
    const activeProv0 = providers.filter((p) => p.active)

    // ---- Aquisição ----
    let newC = Math.round(activeClients0.length * P.clientOrganic) + P.marketingClients
    let newP = Math.round(activeProv0.length * P.providerOrganic) + P.marketingProviders
    const refC = Math.round(activeClients0.reduce((s, c) => s + (c.sat > 0.6 ? c.refProp : 0), 0) * P.referralStrength)
    const refP = Math.round(activeProv0.reduce((s, p) => s + (p.jobs >= 0 && p.earnings > 0 ? p.refProp : 0), 0) * P.referralStrength)
    newC += refC; newP += refP
    if (clients.length < P.maxClients) for (let i = 0; i < newC; i++) clients.push(makeClient(rng))
    if (providers.length < P.maxProviders) for (let i = 0; i < newP; i++) providers.push(makeProvider(rng))
    const referralShare = (newC + newP) > 0 ? (refC + refP) / (newC + newP) : 0

    const active = { clients: clients.filter((c) => c.active), providers: providers.filter((p) => p.active) }
    for (const p of active.providers) p.jobs = 0

    // Índice por região+categoria para matching rápido
    let orders = 0, filled = 0, conversions = 0, gmv = 0, revenue = 0, disputes = 0

    // ---- Demanda + matching + conversão ----
    for (const c of active.clients) {
      const needs = poisson(rng, c.demand)
      for (let k = 0; k < needs; k++) {
        orders++
        const cat = c.cats[rndint(rng, 0, c.cats.length - 1)]
        const value = CAT_BASE[cat] * rnd(rng, 0.8, 1.4)
        // prestadores elegíveis: ativos, mesma região, mesma categoria, com capacidade, que respondem
        const elig = []
        for (const p of active.providers) {
          if (p.region !== c.region) continue
          if (p.jobs >= p.capacity) continue
          if (!p.cats.includes(cat)) continue
          if (rng() > p.responsiveness) continue
          elig.push(p)
        }
        if (elig.length === 0) { c.noService++; c.sat = clamp(c.sat - 0.06, 0, 1); continue }
        filled++ // recebeu ao menos uma proposta (liquidez)
        // melhor proposta por utilidade (confiança + preço)
        let best = null, bestU = -1, bestPrice = 0
        for (const p of elig) {
          const price = value * p.priceLevel * rnd(rng, 0.95, 1.1)
          const trust = p.ratingN > 0 ? clamp((p.ratingSum / p.ratingN - 2.0) / 2.6, 0, 1) : P.coldStartTrust
          const priceFit = clamp(1 - Math.max(0, (price - value) / value) * (0.5 + c.priceSens), 0, 1)
          const u = 0.6 * trust + 0.4 * priceFit
          if (u > bestU) { bestU = u; best = p; bestPrice = price }
        }
        const techFactor = 0.6 + 0.4 * c.tech
        const whatsappPull = (1 - c.tech) * 0.30 + Math.max(0, P.providerSideFee - 0.10) * 0.5
        let pConv = clamp(P.convBase * techFactor * (0.5 + bestU) , 0, 1) * (1 - whatsappPull)
        // porta de confiança: nota abaixo do conforto do cliente reduz conversão
        if (best.ratingN > 0 && best.ratingSum / best.ratingN < c.trustThr) pConv *= 0.7
        if (rng() < pConv) {
          conversions++
          best.jobs++
          // execução: qualidade -> avaliação
          const rating = clamp(Math.round(2.8 + best.quality * 2.2 + rnd(rng, -0.8, 0.8)), 1, 5)
          best.ratingSum += rating; best.ratingN++
          const dispute = rng() < (P.disputeBase + (1 - best.quality) * 0.06)
          if (dispute) {
            disputes++; c.sat = clamp(c.sat - 0.18, 0, 1)
          } else {
            gmv += bestPrice
            revenue += bestPrice * P.takeRate
            best.earnings += bestPrice * (1 - P.providerSideFee)
            c.sat = clamp(c.sat + 0.07, 0, 1); c.noService = 0; c.success++
            // vazamento: relação recorrente migra para fora da plataforma
            if (c.success >= 2 && rng() < P.leakage) c.demand = Math.max(0.05, c.demand - 0.15)
          }
        } else {
          c.sat = clamp(c.sat - 0.02, 0, 1)
        }
      }
    }

    // ---- Inatividade e churn ----
    let churnedC = 0, churnedP = 0
    for (const p of active.providers) {
      if (p.jobs === 0) p.idle++; else p.idle = 0
      const idleChurn = p.idle >= P.providerIdlePatience && rng() < P.providerChurn
      const feeChurn = P.providerSideFee > p.feeTol && p.jobs === 0 && rng() < 0.4
      if (idleChurn || feeChurn) { p.active = false; churnedP++ }
    }
    for (const c of active.clients) {
      const starveChurn = c.noService >= P.clientPatience && rng() < P.clientChurn
      const satChurn = c.sat < 0.35 && rng() < 0.4
      if (starveChurn || satChurn) { c.active = false; churnedC++ }
    }

    // ---- Métricas do mês ----
    const ac = clients.filter((c) => c.active).length
    const ap = providers.filter((p) => p.active).length
    const provWithJobs = providers.filter((p) => p.active && p.idle === 0).length
    const fillRate = orders > 0 ? filled / orders : 0
    const convRate = orders > 0 ? conversions / orders : 0
    const ratedProv = providers.filter((p) => p.ratingN > 0)
    const avgRating = ratedProv.length ? ratedProv.reduce((s, p) => s + p.ratingSum / p.ratingN, 0) / ratedProv.length : 0
    const churnRate = (activeClients0.length ? churnedC / activeClients0.length : 0) * 0.5 + (activeProv0.length ? churnedP / activeProv0.length : 0) * 0.5
    const gmvGrowth = prevGMV > 0 ? (gmv - prevGMV) / prevGMV : (gmv > 0 ? 1 : 0)
    prevGMV = gmv

    const exp = 100 * clamp(
      0.30 * fillRate +
      0.25 * (1 - clamp(churnRate, 0, 1)) +
      0.20 * clamp(0.5 + gmvGrowth, 0, 1) +
      0.15 * (avgRating / 5) +
      0.10 * (ap > 0 ? provWithJobs / ap : 0),
    0, 1)

    hist.push({ m: m + 1, ac, ap, orders, fillRate, convRate, gmv, revenue, avgRating, disputes, churnRate, referralShare, exp })
  }
  return hist
}

function monteCarlo(P, runs, seed0) {
  const all = []
  for (let r = 0; r < runs; r++) all.push(runSim(P, seed0 + r * 7919))
  const out = []
  for (let m = 0; m < P.months; m++) {
    const pick = (k) => all.map((h) => h[m][k])
    out.push({
      m: m + 1,
      ac: Math.round(median(pick('ac'))), ap: Math.round(median(pick('ap'))),
      orders: Math.round(median(pick('orders'))),
      fillRate: median(pick('fillRate')), convRate: median(pick('convRate')),
      gmv: Math.round(median(pick('gmv'))), revenue: Math.round(median(pick('revenue'))),
      avgRating: median(pick('avgRating')), churnRate: median(pick('churnRate')),
      referralShare: median(pick('referralShare')),
      exp: median(pick('exp')), expLo: pct(pick('exp'), 0.1), expHi: pct(pick('exp'), 0.9),
    })
  }
  // probabilidade de "sucesso" no mês 12: liquidez >=60%, base ativa crescente, prestadores com trabalho
  const last = all.map((h) => h[P.months - 1])
  const succ = last.filter((x) => x.fillRate >= 0.6 && x.ac >= 2 * P.startClients && x.ap >= 1.1 * P.startProviders).length / runs
  const supplyRisk = last.filter((x) => x.ap < P.startProviders).length / runs // oferta encolheu vs início
  return { out, successProb: succ, supplyRisk }
}

function scenarios() {
  const base = baseParams()
  const pess = Object.assign({}, base, {
    marketingClients: 4, marketingProviders: 3, clientOrganic: 0.03, providerOrganic: 0.025,
    referralStrength: 0.3, leakage: 0.30, convBase: 0.52, takeRate: 0.22, providerSideFee: 0.13,
  })
  const otim = Object.assign({}, base, {
    marketingClients: 16, marketingProviders: 14, clientOrganic: 0.09, providerOrganic: 0.08,
    referralStrength: 0.9, leakage: 0.10, convBase: 0.70, providerSideFee: 0.08,
  })
  return { pessimista: pess, base, otimista: otim }
}

function fmtTable(name, mc) {
  const L = []
  L.push(`\n=== Cenário: ${name.toUpperCase()} ===`)
  L.push('mês | clientes | prestad. | pedidos | liquidez | conversão | GMV(R$) | receita | nota | churn | indic. | EXPECT.')
  for (const r of mc.out) {
    L.push(
      `${String(r.m).padStart(2)}  | ${String(r.ac).padStart(7)} | ${String(r.ap).padStart(7)} | ${String(r.orders).padStart(6)} | ` +
      `${(r.fillRate * 100).toFixed(0).padStart(6)}% | ${(r.convRate * 100).toFixed(0).padStart(7)}% | ` +
      `${String(r.gmv).padStart(7)} | ${String(r.revenue).padStart(6)} | ${r.avgRating.toFixed(2)} | ` +
      `${(r.churnRate * 100).toFixed(0).padStart(4)}% | ${(r.referralShare * 100).toFixed(0).padStart(4)}% | ${r.exp.toFixed(1).padStart(5)}`,
    )
  }
  const first = mc.out[0].exp, lastE = mc.out[mc.out.length - 1].exp
  const trend = lastE > first + 3 ? 'MELHORA' : lastE < first - 3 ? 'PIORA' : 'ESTÁVEL'
  L.push(`Expectativa: ${first.toFixed(1)} -> ${lastE.toFixed(1)} (${trend}) | P(sucesso m12)=${(mc.successProb * 100).toFixed(0)}% | P(oferta encolhe)=${(mc.supplyRisk * 100).toFixed(0)}%`)
  return L.join('\n')
}

function main() {
  const RUNS = 200, SEED = 12345
  const sc = scenarios()
  const results = {}
  const lines = []
  lines.push('Simulação agent-based — Missão Cumprida | 50 clientes + 50 prestadores iniciais | 12 meses | ' + RUNS + ' execuções Monte Carlo (mediana)')
  for (const name of ['pessimista', 'base', 'otimista']) {
    const mc = monteCarlo(sc[name], RUNS, SEED)
    results[name] = mc
    lines.push(fmtTable(name, mc))
  }
  const txt = lines.join('\n')
  console.log(txt)

  // Exporta JSON + CSV para reuso/visualização
  const fs = require('fs'); const path = require('path')
  const dir = __dirname
  fs.writeFileSync(path.join(dir, 'resultados.json'), JSON.stringify({
    expectativa: { meses: results.base.out.map((r) => r.m),
      pessimista: results.pessimista.out.map((r) => +r.exp.toFixed(1)),
      base: results.base.out.map((r) => +r.exp.toFixed(1)),
      otimista: results.otimista.out.map((r) => +r.exp.toFixed(1)) },
    sucesso: { pessimista: results.pessimista.successProb, base: results.base.successProb, otimista: results.otimista.successProb },
    risco_oferta: { pessimista: results.pessimista.supplyRisk, base: results.base.supplyRisk, otimista: results.otimista.supplyRisk },
    base_mensal: results.base.out,
  }, null, 2))
  let csv = 'cenario,mes,clientes,prestadores,pedidos,liquidez,conversao,gmv,receita,nota,churn,indicacao,expectativa\n'
  for (const name of ['pessimista', 'base', 'otimista'])
    for (const r of results[name].out)
      csv += `${name},${r.m},${r.ac},${r.ap},${r.orders},${r.fillRate.toFixed(3)},${r.convRate.toFixed(3)},${r.gmv},${r.revenue},${r.avgRating.toFixed(2)},${r.churnRate.toFixed(3)},${r.referralShare.toFixed(3)},${r.exp.toFixed(1)}\n`
  fs.writeFileSync(path.join(dir, 'resultados.csv'), csv)
  fs.writeFileSync(path.join(dir, 'relatorio.txt'), txt)
  console.log('\nArquivos: simulacao/resultados.json, resultados.csv, relatorio.txt')
}

main()
