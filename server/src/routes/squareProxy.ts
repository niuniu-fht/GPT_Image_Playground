import { Router } from 'express'
import type { Request } from 'express'
import { HttpError } from '../http.js'
import { getSquareRuntimeConfig } from '../squareConfig.js'

const router = Router()

function copyRequestHeaders(req: Request): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue
    const normalizedKey = key.toLowerCase()
    if (normalizedKey === 'host' || normalizedKey === 'content-length') continue
    headers.set(key, Array.isArray(value) ? value.join(',') : value)
  }
  return headers
}

router.use(async (req, res, next) => {
  try {
    const config = await getSquareRuntimeConfig()
    if (!config.squareApiUrl) {
      throw new HttpError(400, 'square_not_configured', '尚未在管理员后台配置广场 API 地址')
    }

    const targetUrl = `${config.squareApiUrl}${req.originalUrl}`
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: copyRequestHeaders(req),
      body: hasBody ? req : undefined,
      duplex: hasBody ? 'half' : undefined,
    } as RequestInit & { duplex?: 'half' })

    res.status(response.status)
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'content-encoding') return
      res.setHeader(key, value)
    })
    const body = response.body
    if (!body) {
      res.end()
      return
    }
    const reader = body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
    res.end()
  } catch (error) {
    next(error)
  }
})

export default router
