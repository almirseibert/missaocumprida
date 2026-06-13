import { Request, Response } from 'express'
import { prisma } from '../../config/database'
import { verifyAccessToken } from '../../utils/jwt'

// Lê o token JWT do header Authorization OU da query string (?token=).
// O fallback por query é necessário para imagens sensíveis exibidas em <img>,
// que não permitem enviar cabeçalhos.
function readToken(req: Request): { userId: string; role: string } | null {
  const header = req.headers.authorization
  let raw: string | undefined
  if (header?.startsWith('Bearer ')) raw = header.split(' ')[1]
  else if (typeof req.query.token === 'string') raw = req.query.token
  if (!raw) return null
  try {
    return verifyAccessToken(raw)
  } catch {
    return null
  }
}

// GET /api/files/:id — devolve os bytes da imagem armazenada no banco.
// Arquivos públicos (avatar, fotos de pedido/serviço) são abertos.
// Arquivos sensíveis (documentos KYC, selfies) exigem auth: dono ou ADMIN.
export async function getFile(req: Request, res: Response) {
  const file = await prisma.fileAsset.findUnique({ where: { id: req.params.id } })
  if (!file) {
    res.status(404).json({ success: false, message: 'Arquivo não encontrado' })
    return
  }

  if (file.sensitive) {
    const auth = readToken(req)
    if (!auth) {
      res.status(401).json({ success: false, message: 'Não autorizado' })
      return
    }
    const isOwner = file.owner_id && auth.userId === file.owner_id
    const isAdmin = auth.role === 'ADMIN'
    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, message: 'Acesso negado' })
      return
    }
    // Conteúdo sensível: nunca cachear em proxies/navegador compartilhado.
    res.setHeader('Cache-Control', 'private, no-store')
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  }

  res.setHeader('Content-Type', file.mime_type)
  res.setHeader('Content-Length', file.size.toString())
  res.end(file.data) // Bytes (Prisma) -> Buffer (Node)
}
