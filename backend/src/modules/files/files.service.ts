import { Request } from 'express'
import crypto from 'crypto'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import { fileAssetUrl } from '../../utils/url'

// ---------------------------------------------------------------------------
// Links assinados para arquivos sensíveis (documento/selfie KYC).
// O <img> não envia cabeçalho de autorização; antes o JWT ia na URL
// (?token=) e ficava em logs de proxy/histórico. Agora a API entrega, só a
// quem pode ver, um link que vale poucos minutos e serve para um arquivo só.
// ---------------------------------------------------------------------------
const SIGNED_URL_TTL_S = 10 * 60
const FILE_ID_RE = /\/api\/files\/([0-9a-f-]{36})(?:[?#].*)?$/i

function fileSignature(id: string, exp: number): string {
  return crypto.createHmac('sha256', `${env.JWT_SECRET}:files`).update(`${id}.${exp}`).digest('base64url').slice(0, 43)
}

/** Troca a URL de um arquivo sensível por uma assinada de curta duração. */
export function signFileUrl<T extends string | null | undefined>(url: T): T {
  if (!url) return url
  const m = FILE_ID_RE.exec(url)
  if (!m) return url
  const exp = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_S
  const base = url.split(/[?#]/)[0]
  return `${base}?exp=${exp}&sig=${fileSignature(m[1], exp)}` as T
}

/** Confere a assinatura de GET /api/files/:id?exp=&sig=. */
export function verifyFileSignature(id: string, exp: unknown, sig: unknown): boolean {
  if (typeof exp !== 'string' || typeof sig !== 'string') return false
  const expN = Number(exp)
  if (!Number.isFinite(expN) || expN < Date.now() / 1000) return false
  const expected = Buffer.from(fileSignature(id, expN))
  const got = Buffer.from(sig)
  return expected.length === got.length && crypto.timingSafeEqual(expected, got)
}

type PersistOpts = {
  /** Marca o arquivo como sensível (KYC/selfie) — exige auth para baixar. */
  sensitive?: boolean
  /** Dono do arquivo, usado para autorizar o download de itens sensíveis. */
  ownerId?: string
}

/**
 * Detecta o tipo real pela assinatura do arquivo. O mimetype do multipart é
 * declarado pelo cliente e não é confiável (poderia ser HTML/SVG renomeado).
 */
export function detectImageMime(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

/** Erro de imagem inválida — vira 400 no errorHandler. */
export class InvalidImageError extends Error {
  status = 400
  constructor(message = 'Apenas imagens JPEG, PNG e WebP são aceitas') {
    super(message)
  }
}

// sharp é carregado sob demanda: se o binário nativo não estiver disponível
// no servidor, o upload continua funcionando com a imagem original.
let sharpLoader: Promise<any | null> | null = null
function loadSharp(): Promise<any | null> {
  if (!sharpLoader) {
    sharpLoader = import('sharp')
      .then((m) => (m as any).default ?? m)
      .catch((err) => {
        console.error('[files] sharp indisponível — imagens serão salvas sem otimização:', err?.message)
        return null
      })
  }
  return sharpLoader
}

/**
 * Normaliza a foto antes de guardar: corrige a rotação, reduz para no máximo
 * 1600 px (2000 px em documentos) e recomprime em JPEG. Remove os metadados
 * EXIF — inclusive a localização GPS que o celular grava na foto.
 */
async function optimizeImage(buffer: Buffer, sensitive: boolean): Promise<{ data: Buffer; mime: string } | null> {
  const sharp = await loadSharp()
  if (!sharp) return null
  try {
    const maxSide = sensitive ? 2000 : 1600
    const data: Buffer = await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: sensitive ? 88 : 80, mozjpeg: true })
      .toBuffer()
    return { data, mime: 'image/jpeg' }
  } catch {
    throw new InvalidImageError('Não foi possível ler a imagem enviada. Tente outra foto.')
  }
}

/** Persiste um buffer de imagem no banco e devolve o registro criado. */
export async function saveFileAsset(buffer: Buffer, _declaredMime: string, opts: PersistOpts = {}) {
  const detected = detectImageMime(buffer)
  if (!detected) throw new InvalidImageError()
  const optimized = await optimizeImage(buffer, opts.sensitive ?? false)
  const data = optimized?.data ?? buffer
  const mimeType = optimized?.mime ?? detected
  return prisma.fileAsset.create({
    data: {
      data,
      mime_type: mimeType,
      size: data.length,
      sensitive: opts.sensitive ?? false,
      owner_id: opts.ownerId ?? null,
    },
    select: { id: true },
  })
}

/**
 * Persiste o arquivo de um upload (req.file) e devolve a URL pública.
 * Para documentos KYC/selfie, passe { sensitive: true, ownerId } — o acesso
 * passa a exigir autenticação (dono ou admin).
 */
export async function persistUpload(
  req: Request,
  file: Express.Multer.File,
  opts: PersistOpts = {},
): Promise<string> {
  const asset = await saveFileAsset(file.buffer, file.mimetype, opts)
  return fileAssetUrl(req, asset.id)
}
