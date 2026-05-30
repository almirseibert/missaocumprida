import { Response } from 'express'

export function ok(res: Response, data: unknown, message = 'Sucesso') {
  return res.status(200).json({ success: true, message, data })
}

export function created(res: Response, data: unknown, message = 'Criado com sucesso') {
  return res.status(201).json({ success: true, message, data })
}

export function noContent(res: Response) {
  return res.status(204).send()
}

export function badRequest(res: Response, message: string, errors?: unknown) {
  return res.status(400).json({ success: false, message, errors })
}

export function unauthorized(res: Response, message = 'Não autorizado') {
  return res.status(401).json({ success: false, message })
}

export function forbidden(res: Response, message = 'Acesso negado') {
  return res.status(403).json({ success: false, message })
}

export function notFound(res: Response, message = 'Não encontrado') {
  return res.status(404).json({ success: false, message })
}

export function conflict(res: Response, message: string) {
  return res.status(409).json({ success: false, message })
}

export function serverError(res: Response, message = 'Erro interno do servidor') {
  return res.status(500).json({ success: false, message })
}
