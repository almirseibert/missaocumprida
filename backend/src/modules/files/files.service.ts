import { Request } from 'express'
import { prisma } from '../../config/database'
import { fileAssetUrl } from '../../utils/url'

/** Persiste um buffer de imagem no banco e devolve o registro criado. */
export async function saveFileAsset(buffer: Buffer, mimeType: string) {
  return prisma.fileAsset.create({
    data: { data: buffer, mime_type: mimeType, size: buffer.length },
    select: { id: true },
  })
}

/**
 * Persiste o arquivo de um upload (req.file) e devolve a URL pública.
 * Usado pelos controllers de upload (avatar, documentos, fotos etc.).
 */
export async function persistUpload(req: Request, file: Express.Multer.File): Promise<string> {
  const asset = await saveFileAsset(file.buffer, file.mimetype)
  return fileAssetUrl(req, asset.id)
}
