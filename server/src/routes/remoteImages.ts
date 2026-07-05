import dns from 'node:dns/promises'
import net from 'node:net'
import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../auth.js'
import { HttpError } from '../http.js'

const router = Router()
const MAX_REMOTE_IMAGE_BYTES = 30 * 1024 * 1024

const requestSchema = z.object({
  url: z.string().url(),
})

async function fetchPublicImage(url: URL, redirectCount = 0): Promise<Response> {
  if (redirectCount > 5) {
    throw new HttpError(400, 'remote_image_too_many_redirects', '远程图片重定向次数过多')
  }

  await assertPublicRemoteUrl(url)
  const response = await fetch(url, {
    headers: {
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5',
      'User-Agent': 'GPT-Image-Playground/1.0 image-fetch',
    },
    redirect: 'manual',
  })

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (!location) {
      throw new HttpError(400, 'remote_image_redirect_failed', '远程图片重定向地址为空')
    }

    return fetchPublicImage(new URL(location, url), redirectCount + 1)
  }

  return response
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }

  const [a, b] = parts
  if (a === undefined || b === undefined) return true
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase()
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  )
}

function isBlockedIpAddress(address: string): boolean {
  const family = net.isIP(address)
  if (family === 4) return isPrivateIpv4(address)
  if (family === 6) return isPrivateIpv6(address)
  return true
}

async function assertPublicRemoteUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'invalid_remote_image_url', '只支持 http 或 https 图片地址')
  }

  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new HttpError(400, 'invalid_remote_image_url', '不允许读取本机地址')
  }

  if (net.isIP(hostname) && isBlockedIpAddress(hostname)) {
    throw new HttpError(400, 'invalid_remote_image_url', '不允许读取内网图片地址')
  }

  const records = await dns.lookup(hostname, { all: true }).catch(() => {
    throw new HttpError(400, 'remote_image_lookup_failed', '图片域名解析失败')
  })
  if (!records.length || records.some((record) => isBlockedIpAddress(record.address))) {
    throw new HttpError(400, 'invalid_remote_image_url', '不允许读取内网图片地址')
  }
}

async function readImageBuffer(response: Response): Promise<Buffer> {
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_REMOTE_IMAGE_BYTES) {
    throw new HttpError(413, 'remote_image_too_large', '图片过大，请压缩后再发布')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new HttpError(502, 'remote_image_empty', '远程图片没有返回内容')
  }

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > MAX_REMOTE_IMAGE_BYTES) {
      throw new HttpError(413, 'remote_image_too_large', '图片过大，请压缩后再发布')
    }
    chunks.push(value)
  }

  return Buffer.concat(chunks, total)
}

router.post('/fetch', requireUser, async (req, res, next) => {
  try {
    const input = requestSchema.parse(req.body)
    const url = new URL(input.url)
    await assertPublicRemoteUrl(url)

    const response = await fetchPublicImage(url)
    if (!response.ok) {
      throw new HttpError(response.status, 'remote_image_fetch_failed', `远程图片读取失败：HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream'
    if (!contentType.startsWith('image/')) {
      throw new HttpError(400, 'remote_image_not_image', '远程地址返回的不是图片内容')
    }

    const buffer = await readImageBuffer(response)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', String(buffer.byteLength))
    res.setHeader('Cache-Control', 'no-store')
    res.send(buffer)
  } catch (error) {
    next(error)
  }
})

export default router
