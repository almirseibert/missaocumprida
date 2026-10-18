import { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/database'
import { verifyAccessToken } from '../utils/jwt'

/**
 * Antes dos uploads irem para o banco, documentos e selfies KYC eram salvos em
 * disco e servidos por /uploads sem autenticação. Este guard bloqueia esses
 * arquivos (exceto para o dono ou ADMIN) enquanto o diretório legado existir.
 */
export async function blockLegacySensitiveUploads(req: Request, res: Response, next: NextFunction) {
  const file = req.path.replace(/^\/+/, '')
  if (!file) return next()
  try {
    const owner = await prisma.user.findFirst({
      where: {
        OR: [
          { document_photo_url: { endsWith: `/uploads/${file}` } },
          { selfie_photo_url: { endsWith: `/uploads/${file}` } },
        ],
      },
      select: { id: true },
    })
    if (!owner) return next()

    const header = req.headers.authorization
    const raw = header?.startsWith('Bearer ') ? header.slice(7) : (req.query.token as string | undefined)
    const auth = raw ? verifyAccessToken(raw) : null
    if (auth && (auth.userId === owner.id || auth.role === 'ADMIN')) {
      res.setHeader('Cache-Control', 'private, no-store')
      return next()
    }
  } catch {
    // token inválido ou erro de banco: nega por segurança
  }
  res.status(404).json({ success: false, message: 'Arquivo não encontrado' })
}
