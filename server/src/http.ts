import type { Response } from 'express'

export class HttpError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function sendOk(res: Response, data: unknown = {}) {
  res.json({ ok: true, data })
}

export function sendError(res: Response, error: unknown) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ ok: false, code: error.code, message: error.message })
    return
  }

  console.error(error)
  res.status(500).json({
    ok: false,
    code: 'internal_error',
    message: error instanceof Error ? error.message : '服务暂时不可用',
  })
}
