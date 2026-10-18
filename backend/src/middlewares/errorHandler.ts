import { Request, Response, NextFunction } from 'express'
import multer from 'multer'

export function errorHandler(
  err: Error & { type?: string; status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Erros do cliente não são 500: upload inválido/grande demais e JSON malformado.
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo muito grande' : 'Upload inválido'
    return res.status(400).json({ success: false, message })
  }
  if (err.message === 'Apenas imagens JPEG, PNG e WebP são aceitas') {
    return res.status(400).json({ success: false, message: err.message })
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'JSON inválido' })
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Requisição muito grande' })
  }
  if (err.message === 'Origin não permitida pelo CORS') {
    return res.status(403).json({ success: false, message: err.message })
  }

  console.error('[ERROR]', err.message, err.stack)
  res.status(500).json({ success: false, message: 'Erro interno do servidor' })
}
