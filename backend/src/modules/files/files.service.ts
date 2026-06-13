import { Request } from 'express'
import { prisma } from '../../config/database'
import { fileAssetUrl } from '../../utils/url'

type PersistOpts = {
  /** Marca o arquivo como sensível (KYC/selfie) — exige auth para baixar. */
  sensitive?: boolean
  /** Dono do arquivo, usado para autorizar o download de itens sensíveis. */
  ownerId?: string
}

/** Persiste um buffer de imagem no banco e devolve o registro criado. */
export async function saveFileAsset(buffer: Buffer, mimeType: string, opts: PersistOpts = {}) {
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
