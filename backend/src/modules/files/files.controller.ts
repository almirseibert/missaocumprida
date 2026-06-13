import { Request, Response } from 'express'
import { prisma } from '../../config/database'

// GET /api/files/:id — devolve os bytes da imagem armazenada no banco.
// Público (sem auth) para funcionar em <img src>. O conteúdo é imutável
// (endereçado pelo id), então pode ser cacheado agressivamente.
export async function getFile(req: Request, res: Response) {
  const file = await prisma.fileAsset.findUnique({ where: { id: req.params.id } })
  if (!file) {
    res.status(404).json({ success: false, message: 'Arquivo não encontrado' })
    return
  }

  res.setHeader('Content-Type', file.mime_type)
  res.setHeader('Content-Length', file.size.toString())
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.end(file.data) // Bytes (Prisma) -> Buffer (Node)
}
