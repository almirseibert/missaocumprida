import { Request } from 'express'
import { prisma } from '../../config/database'
import { fileAssetUrl } from '../../utils/url'

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

/** Persiste um buffer de imagem no banco e devolve o registro criado. */
export async function saveFileAsset(buffer: Buffer, _declaredMime: string, opts: PersistOpts = {}) {
  const mimeType = detectImageMime(buffer)
  if (!mimeType) throw new Error('Apenas imagens JPEG, PNG e WebP são aceitas')
  return prisma.fileAsset.create({
    data: {
      data: buffer,
      mime_type: mimeType,
      size: buffer.length,
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
