import { getConfig } from './config'
import type { Env } from './types'

export interface CorsResult {
  allowed: boolean
  headers: HeadersInit
}

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]')
    )
  } catch {
    return false
  }
}

export function resolveCors(request: Request, env: Env): CorsResult {
  const origin = request.headers.get('Origin')?.replace(/\/+$/, '') ?? ''
  if (!origin) {
    return {
      allowed: true,
      headers: {},
    }
  }

  const allowedOrigins = getConfig(env).allowedOrigins
  const allowed = allowedOrigins.includes(origin) || isLocalDevelopmentOrigin(origin)
  if (!allowed) {
    return {
      allowed: false,
      headers: {},
    }
  }

  return {
    allowed: true,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  }
}

export function createOptionsResponse(cors: CorsResult): Response {
  if (!cors.allowed) {
    return new Response(null, { status: 403 })
  }

  return new Response(null, {
    status: 204,
    headers: cors.headers,
  })
}
