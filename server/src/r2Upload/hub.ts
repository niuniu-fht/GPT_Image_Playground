import { getGeneratedImageFilePath } from '../generatedImageFiles.js'

const MAX_UPLOAD_BYTES = 45 * 1024 * 1024
const FETCH_TIMEOUT_MS = 120_000

export interface UploadImageSource {
  data: Buffer
  filename: string
  contentType: string
}

export interface R2HubUploadResult {
  url: string
  key: string
  bucket: string
  size: number
}

function extensionForMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/gif': 'gif',
  }
  return map[mimeType.toLowerCase()] ?? 'bin'
}

/** 把 outputImages 里存的三种形态（本地交付地址 / 远程 URL / base64 dataURL）读成字节。 */
export async function readImageSource(dataUrl: string, mimeType: string, taskId: string, index: number): Promise<UploadImageSource> {
  if (/^data:image\//i.test(dataUrl)) {
    const commaIndex = dataUrl.indexOf(',')
    if (commaIndex < 0) throw new Error('base64 dataURL 缺少逗号分隔')
    const data = Buffer.from(dataUrl.slice(commaIndex + 1), 'base64')
    if (!data.length) throw new Error('base64 图片解码为空')
    return { data, filename: `${taskId}-${index}.${extensionForMimeType(mimeType)}`, contentType: mimeType }
  }

  const deliveryMatch = /^\/api\/generations\/([^/]+)\/images\/(\d+)$/i.exec(dataUrl)
  if (deliveryMatch) {
    const [, taskId, indexText] = deliveryMatch
    const filePath = getGeneratedImageFilePath(taskId, Number(indexText), mimeType)
    const { readFile } = await import('node:fs/promises')
    const data = await readFile(filePath)
    return { data, filename: `${taskId}-${index}.${extensionForMimeType(mimeType)}`, contentType: mimeType }
  }

  if (/^https?:\/\//i.test(dataUrl)) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const response = await fetch(dataUrl, { signal: controller.signal })
      if (!response.ok) throw new Error(`源图片请求失败 HTTP ${response.status}`)
      const buffer = Buffer.from(await response.arrayBuffer())
      if (!buffer.length) throw new Error('源图片请求返回空内容')
      const contentType = response.headers.get('content-type')?.split(';')[0] || mimeType
      return { data: buffer, filename: `${taskId}-${index}.${extensionForMimeType(mimeType)}`, contentType }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw new Error(`不支持的图片来源：${dataUrl.slice(0, 60)}`)
}

/** 调用 r2hub（8100 端口服务）上传图片，返回其公网 URL（桶池的 pub/pre 域名地址）。 */
export async function uploadToR2Hub(input: UploadImageSource & { hubUrl: string; hubApiKey: string }): Promise<R2HubUploadResult> {
  if (!input.hubUrl) throw new Error('r2hub 地址未配置')
  if (!input.hubApiKey) throw new Error('r2hub API Key 未配置')
  if (input.data.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`图片超过 ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB，跳过 R2 上传`)
  }

  const form = new FormData()
  const bytes = new Uint8Array(input.data)
  form.append('file', new Blob([bytes], { type: input.contentType }), input.filename)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(`${input.hubUrl}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.hubApiKey}`,
      },
      body: form,
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = typeof (payload as { detail?: unknown }).detail === 'string'
        ? (payload as { detail: string }).detail
        : `r2hub 上传失败 HTTP ${response.status}`
      throw new Error(message)
    }
    const url = typeof (payload as { url?: unknown }).url === 'string' ? (payload as { url: string }).url : ''
    if (!url) throw new Error('r2hub 未返回公网 URL')
    return {
      url,
      key: typeof (payload as { key?: unknown }).key === 'string' ? (payload as { key: string }).key : '',
      bucket: typeof (payload as { bucket?: unknown }).bucket === 'string' ? (payload as { bucket: string }).bucket : '',
      size: typeof (payload as { size?: unknown }).size === 'number' ? (payload as { size: number }).size : input.data.byteLength,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
