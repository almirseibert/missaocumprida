import multer from 'multer'
import { env } from '../config/env'

// Armazenamento em memória: o arquivo chega como Buffer (req.file.buffer)
// e é persistido no banco (tabela file_assets) pelos controllers. Não usamos
// mais disco — isso garante que as imagens sobrevivam a redeploys e que as
// URLs nunca apontem para localhost.
const storage = multer.memoryStorage()

function fileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Apenas imagens JPEG, PNG e WebP são aceitas'))
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
})
