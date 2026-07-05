import type {
  SquareIdentity,
  SquareListInput,
  SquareListResult,
  SquareMySharesInput,
  SquareShareDetail,
  SquareShareSummary,
} from '../../../types'
import { readSquareIdentity, saveSquareIdentity } from './squareIdentity'
import { SQUARE_MAX_REQUEST_BYTES } from './squareLimits'

export interface SquareCreateShareAssetInput {
  clientAssetId: string
  original: Blob
  thumbnail: Blob
}

export interface SquareCreateShareInput {
  manifest: unknown
  assets: SquareCreateShareAssetInput[]
}

export interface SquareCreateShareResult {
  id: string
}

export interface SquareApiClient {
  isConfigured(): boolean
  listSquare(input: SquareListInput): Promise<SquareListResult>
  listMyShares(input: SquareMySharesInput): Promise<SquareListResult>
  getShare(id: string): Promise<SquareShareDetail>
  createShare(input: SquareCreateShareInput): Promise<SquareCreateShareResult>
  deleteShare(id: string): Promise<void>
  reportShare(id: string, reason: string): Promise<void>
  resolveUrl(pathOrUrl: string): string
}

type ApiEnvelope<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error?: {
        code?: string
        message?: string
        requestId?: string
      }
    }

const MULTIPART_FIELD_OVERHEAD_BYTES = 512

function getSquareApiBaseUrl(): string {
  return ''
}

function buildQuery(input: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    if (value == null || value === '') continue
    params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

function normalizeEnvelope<T>(value: unknown): ApiEnvelope<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('广场接口返回格式无效')
  }

  const record = value as ApiEnvelope<T>
  if (record.ok === true || record.ok === false) {
    return record
  }

  throw new Error('广场接口返回缺少 ok 字段')
}

function resolveSquareHttpErrorMessage(status: number): string {
  if (status === 401) return '广场登录状态已失效，请重试'
  if (status === 403) return '当前没有权限执行这个广场操作'
  if (status === 413) return '发布内容太大，请减少图片数量或压缩后再试'
  if (status >= 500) return '广场服务暂时不可用，请稍后重试'
  return `广场接口请求失败：HTTP ${status}`
}

async function readJsonEnvelope<T>(response: Response): Promise<T> {
  let rawPayload: unknown
  try {
    rawPayload = await response.json()
  } catch {
    throw new Error(resolveSquareHttpErrorMessage(response.status))
  }

  const payload = normalizeEnvelope<T>(rawPayload)
  if (!payload.ok) {
    throw new Error(payload.error?.message || resolveSquareHttpErrorMessage(response.status))
  }

  return payload.data
}

function assertConfigured(baseUrl: string) {
  void baseUrl
}

function createAssetFileName(clientAssetId: string, variant: 'original' | 'thumb', blob: Blob): string {
  const mime = blob.type.toLowerCase()
  const ext = mime.includes('jpeg') || mime.includes('jpg')
    ? 'jpg'
    : mime.includes('webp')
      ? 'webp'
      : 'png'
  return `${clientAssetId}-${variant}.${ext}`
}

function estimateShareRequestBytes(input: SquareCreateShareInput): number {
  const manifest = JSON.stringify(input.manifest)
  const manifestBytes = new Blob([manifest]).size
  const assetBytes = input.assets.reduce(
    (total, asset) =>
      total +
      asset.original.size +
      asset.thumbnail.size +
      MULTIPART_FIELD_OVERHEAD_BYTES * 2,
    0,
  )

  return manifestBytes + assetBytes + MULTIPART_FIELD_OVERHEAD_BYTES
}

function formatMegabytes(bytes: number): string {
  return `${Math.ceil(bytes / 1024 / 1024)} MB`
}

function assertShareRequestSize(input: SquareCreateShareInput) {
  const estimatedBytes = estimateShareRequestBytes(input)
  if (estimatedBytes <= SQUARE_MAX_REQUEST_BYTES) return

  throw new Error(
    `发布内容约 ${formatMegabytes(estimatedBytes)}，超过 ${formatMegabytes(SQUARE_MAX_REQUEST_BYTES)} 限制。请减少任务链图片数量或压缩图片后再发布。`,
  )
}

class HttpSquareApiClient implements SquareApiClient {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  isConfigured(): boolean {
    return true
  }

  resolveUrl(pathOrUrl: string): string {
    if (!pathOrUrl) return ''
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
    if (!this.baseUrl) return pathOrUrl
    return `${this.baseUrl}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`
  }

  async listSquare(input: SquareListInput): Promise<SquareListResult> {
    assertConfigured(this.baseUrl)
    const query = buildQuery({
      kind: input.kind,
      sort: input.sort ?? 'latest',
      q: input.q?.trim() || undefined,
      cursor: input.cursor,
      limit: input.limit ?? 30,
    })
    const response = await fetch(`${this.baseUrl}/api/v1/square${query}`)
    return readJsonEnvelope<SquareListResult>(response)
  }

  async listMyShares(input: SquareMySharesInput): Promise<SquareListResult> {
    assertConfigured(this.baseUrl)
    const identity = await this.ensureIdentity()
    const query = buildQuery({
      q: input.q?.trim() || undefined,
      cursor: input.cursor,
      limit: input.limit ?? 30,
    })
    const response = await fetch(`${this.baseUrl}/api/v1/me/shares${query}`, {
      headers: {
        Authorization: `Bearer ${identity.token}`,
      },
    })
    return readJsonEnvelope<SquareListResult>(response)
  }

  async getShare(id: string): Promise<SquareShareDetail> {
    assertConfigured(this.baseUrl)
    const response = await fetch(`${this.baseUrl}/api/v1/shares/${encodeURIComponent(id)}`)
    return readJsonEnvelope<SquareShareDetail>(response)
  }

  async createShare(input: SquareCreateShareInput): Promise<SquareCreateShareResult> {
    assertConfigured(this.baseUrl)
    assertShareRequestSize(input)
    const identity = await this.ensureIdentity()
    const form = new FormData()
    form.append('manifest', JSON.stringify(input.manifest))
    for (const asset of input.assets) {
      form.append(
        `asset:${asset.clientAssetId}:original`,
        asset.original,
        createAssetFileName(asset.clientAssetId, 'original', asset.original),
      )
      form.append(
        `asset:${asset.clientAssetId}:thumb`,
        asset.thumbnail,
        createAssetFileName(asset.clientAssetId, 'thumb', asset.thumbnail),
      )
    }

    const response = await fetch(`${this.baseUrl}/api/v1/shares`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${identity.token}`,
      },
      body: form,
    })

    return readJsonEnvelope<SquareCreateShareResult>(response)
  }

  async deleteShare(id: string): Promise<void> {
    assertConfigured(this.baseUrl)
    const identity = await this.ensureIdentity()
    const response = await fetch(`${this.baseUrl}/api/v1/shares/${encodeURIComponent(id)}/delete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${identity.token}`,
      },
    })
    await readJsonEnvelope<Record<string, never>>(response)
  }

  async reportShare(id: string, reason: string): Promise<void> {
    assertConfigured(this.baseUrl)
    const response = await fetch(`${this.baseUrl}/api/v1/shares/${encodeURIComponent(id)}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    })
    await readJsonEnvelope<Record<string, never>>(response)
  }

  private async ensureIdentity(): Promise<SquareIdentity> {
    const cached = readSquareIdentity()
    if (cached) return cached

    const response = await fetch(`${this.baseUrl}/api/v1/identity`, {
      method: 'POST',
    })
    const identity = await readJsonEnvelope<SquareIdentity>(response)
    saveSquareIdentity(identity)
    return identity
  }
}

export const squareApiClient: SquareApiClient = new HttpSquareApiClient(getSquareApiBaseUrl())

export function resolveSquareAssetUrl(pathOrUrl: string): string {
  return squareApiClient.resolveUrl(pathOrUrl)
}

export function isSquareApiConfigured(): boolean {
  return squareApiClient.isConfigured()
}

export function summarizeSquareShare(item: SquareShareSummary): string {
  return item.title.trim() || item.prompt.trim().slice(0, 48) || '未命名分享'
}
