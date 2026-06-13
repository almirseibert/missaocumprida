/**
 * Migra imagens antigas (armazenadas em disco em ./uploads) para o banco
 * (tabela file_assets) e reescreve as URLs gravadas nos registros.
 *
 * Rode UMA vez no servidor onde os arquivos ainda existem em disco:
 *
 *   # base pública HTTPS da API (mesmo domínio que o front usa p/ chamar a API)
 *   PUBLIC_API_URL="https://SEU-BACKEND.easypanel.host" npx ts-node prisma/migrate-uploads-to-db.ts
 *
 * É idempotente: URLs que já apontam para /api/files/ são ignoradas, e cada
 * arquivo só é importado uma vez (cache por nome de arquivo).
 */
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const BASE_URL = (process.env.PUBLIC_API_URL || process.env.API_URL || '').replace(/\/+$/, '')

if (!BASE_URL || BASE_URL.includes('localhost')) {
  console.error(
    '\n[ERRO] Defina PUBLIC_API_URL com o domínio HTTPS público da API.\n' +
      'Ex.: PUBLIC_API_URL="https://missaocumprida-back.xxxx.easypanel.host" npx ts-node prisma/migrate-uploads-to-db.ts\n',
  )
  process.exit(1)
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

// cache: nome do arquivo em disco -> nova URL /api/files/:id (evita duplicar)
const imported = new Map<string, string>()
let createdCount = 0
let missingCount = 0

/** Se a string for uma URL /uploads/<arquivo>, importa o arquivo e devolve a nova URL. */
async function convert(url: string | null | undefined): Promise<string | null | undefined> {
  if (!url || typeof url !== 'string') return url
  if (url.includes('/api/files/')) return url // já migrado

  const m = url.match(/\/uploads\/([^/?#]+)/)
  if (!m) return url // não é uma URL de upload local — mantém

  const filename = decodeURIComponent(m[1])
  if (imported.has(filename)) return imported.get(filename)!

  const filePath = path.resolve(UPLOAD_DIR, filename)
  if (!fs.existsSync(filePath)) {
    missingCount++
    console.warn(`  [faltando] arquivo não encontrado em disco: ${filename}`)
    return url // mantém a URL antiga; não há o que importar
  }

  const buffer = fs.readFileSync(filePath)
  const ext = path.extname(filename).toLowerCase()
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream'

  const asset = await prisma.fileAsset.create({
    data: { data: buffer, mime_type: mime, size: buffer.length },
    select: { id: true },
  })
  const newUrl = `${BASE_URL}/api/files/${asset.id}`
  imported.set(filename, newUrl)
  createdCount++
  return newUrl
}

async function run() {
  console.log(`\nMigrando uploads de "${UPLOAD_DIR}" -> banco. Base: ${BASE_URL}\n`)

  // ---- User: avatar, document_photo_url, selfie_photo_url ----
  const users = await prisma.user.findMany({
    select: { id: true, avatar: true, document_photo_url: true, selfie_photo_url: true },
  })
  for (const u of users) {
    const avatar = await convert(u.avatar)
    const doc = await convert(u.document_photo_url)
    const selfie = await convert(u.selfie_photo_url)
    if (avatar !== u.avatar || doc !== u.document_photo_url || selfie !== u.selfie_photo_url) {
      await prisma.user.update({
        where: { id: u.id },
        data: { avatar, document_photo_url: doc, selfie_photo_url: selfie },
      })
    }
  }
  console.log(`Usuários processados: ${users.length}`)

  // ---- Order.photos (String[]) ----
  const orders = await prisma.order.findMany({ select: { id: true, photos: true } })
  for (const o of orders) {
    const newPhotos = await Promise.all(o.photos.map((p) => convert(p)))
    const changed = newPhotos.some((p, i) => p !== o.photos[i])
    if (changed) {
      await prisma.order.update({ where: { id: o.id }, data: { photos: newPhotos as string[] } })
    }
  }
  console.log(`Pedidos processados: ${orders.length}`)

  // ---- Schedule: checkin_photo_url, complete_photo_url ----
  const schedules = await prisma.schedule.findMany({
    select: { id: true, checkin_photo_url: true, complete_photo_url: true },
  })
  for (const s of schedules) {
    const checkin = await convert(s.checkin_photo_url)
    const complete = await convert(s.complete_photo_url)
    if (checkin !== s.checkin_photo_url || complete !== s.complete_photo_url) {
      await prisma.schedule.update({
        where: { id: s.id },
        data: { checkin_photo_url: checkin, complete_photo_url: complete },
      })
    }
  }
  console.log(`Agendamentos processados: ${schedules.length}`)

  // ---- ServicePackage.photos (String[]) ----
  const packages = await prisma.servicePackage.findMany({ select: { id: true, photos: true } })
  for (const pkg of packages) {
    const newPhotos = await Promise.all(pkg.photos.map((p) => convert(p)))
    const changed = newPhotos.some((p, i) => p !== pkg.photos[i])
    if (changed) {
      await prisma.servicePackage.update({ where: { id: pkg.id }, data: { photos: newPhotos as string[] } })
    }
  }
  console.log(`Pacotes processados: ${packages.length}`)

  // ---- Message.photo_url ----
  const messages = await prisma.message.findMany({
    where: { photo_url: { not: null } },
    select: { id: true, photo_url: true },
  })
  for (const msg of messages) {
    const photo = await convert(msg.photo_url)
    if (photo !== msg.photo_url) {
      await prisma.message.update({ where: { id: msg.id }, data: { photo_url: photo } })
    }
  }
  console.log(`Mensagens processadas: ${messages.length}`)

  console.log(`\n✅ Concluído. Arquivos importados: ${createdCount}. Faltando em disco: ${missingCount}.\n`)
}

run()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
