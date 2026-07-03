import { getConfig } from './config'
import {
  badRequest,
  payloadTooLarge,
  unsupportedMediaType,
  validationFailed,
} from './errors'
import type { Env, ManifestAsset, ShareKind, ShareManifest, UploadedAsset } from './types'

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const MAX_TITLE_LENGTH = 80
const MAX_PROMPT_LENGTH = 8000
const MAX_TAG_COUNT = 8
const MAX_TAG_LENGTH = 24
const MAX_TASK_LINEAGE_ITEMS = 12
const MAX_ASSET_COUNT = 24

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw validationFailed(`${field} 必须是字符串`)
  }
  const normalized = value.trim()
  if (!normalized) {
    throw validationFailed(`${field} 不能为空`)
  }
  if (normalized.length > maxLength) {
    throw validationFailed(`${field} 不能超过 ${maxLength} 字符`)
  }
  return normalized
}

function readOptionalNumber(value: unknown, field: string): number | null {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw validationFailed(`${field} 必须是数字`)
  }
  return value
}

function normalizeTags(value: unknown): string[] {
  if (value == null) return []
  if (!Array.isArray(value)) {
    throw validationFailed('tags 必须是字符串数组')
  }

  return Array.from(
    new Set(
      value.map((tag, index) => {
        if (typeof tag !== 'string') {
          throw validationFailed(`tags[${index}] 必须是字符串`)
        }
        return tag.trim().slice(0, MAX_TAG_LENGTH)
      }).filter(Boolean),
    ),
  ).slice(0, MAX_TAG_COUNT)
}

function readKind(value: unknown): ShareKind {
  if (value === 'image' || value === 'task' || value === 'prompt') {
    return value
  }
  throw validationFailed('kind 只允许 image、task 或 prompt')
}

function normalizeManifestAsset(value: unknown, index: number): ManifestAsset {
  if (!isRecord(value)) {
    throw validationFailed(`assets[${index}] 必须是对象`)
  }

  const clientAssetId = readString(value.clientAssetId, `assets[${index}].clientAssetId`, 120)
  const role = value.role === 'output' || value.role === 'origin_input'
    ? value.role
    : (() => {
        throw validationFailed(`assets[${index}].role 不合法`)
      })()
  const mimeType = readString(value.mimeType, `assets[${index}].mimeType`, 64).toLowerCase()
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw unsupportedMediaType('广场暂只支持 PNG、JPG、JPEG、WebP 图片')
  }

  const byteSize = readOptionalNumber(value.byteSize, `assets[${index}].byteSize`)
  if (!byteSize || byteSize <= 0) {
    throw validationFailed(`assets[${index}].byteSize 必须大于 0`)
  }
  if (role === 'origin_input' && value.standaloneShareAllowed === true) {
    throw validationFailed('源输入图只能作为任务链素材附带，不能作为独立广场内容')
  }

  return {
    clientAssetId,
    role,
    localImageId: typeof value.localImageId === 'string' ? value.localImageId : undefined,
    mimeType,
    width: readOptionalNumber(value.width, `assets[${index}].width`),
    height: readOptionalNumber(value.height, `assets[${index}].height`),
    byteSize,
    standaloneShareAllowed:
      typeof value.standaloneShareAllowed === 'boolean'
        ? value.standaloneShareAllowed
        : undefined,
  }
}

function assertLineageItemsValid(value: unknown): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw validationFailed('图任务分享必须包含任务链')
  }
  if (value.length > MAX_TASK_LINEAGE_ITEMS) {
    throw validationFailed(`任务链最多 ${MAX_TASK_LINEAGE_ITEMS} 个节点`)
  }

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      throw validationFailed(`任务链节点 ${index + 1} 必须是对象`)
    }
    if (item.status !== 'done') {
      throw validationFailed('只能分享成功完成的图任务')
    }
    if (item.taskKind === 'image') {
      throw validationFailed('用户上传的单图任务不能作为广场图任务发布')
    }
    if (item.isAborted === true) {
      throw validationFailed('已中止任务不能分享到广场')
    }
  })
}

function parseManifest(raw: string): ShareManifest {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw badRequest('manifest 不是合法 JSON')
  }

  if (!isRecord(parsed)) {
    throw validationFailed('manifest 必须是对象')
  }

  const kind = readKind(parsed.kind)
  const assets = Array.isArray(parsed.assets)
    ? parsed.assets.map((asset, index) => normalizeManifestAsset(asset, index))
    : []
  if (assets.length > MAX_ASSET_COUNT) {
    throw validationFailed(`单次分享最多包含 ${MAX_ASSET_COUNT} 个图片资产`)
  }

  const manifest: ShareManifest = {
    ...parsed,
    kind,
    clientRequestId: readString(parsed.clientRequestId, 'clientRequestId', 160),
    title: readString(parsed.title, 'title', MAX_TITLE_LENGTH),
    prompt: readString(parsed.prompt, 'prompt', MAX_PROMPT_LENGTH),
    tags: normalizeTags(parsed.tags),
    assets,
    turnstileToken:
      typeof parsed.turnstileToken === 'string' && parsed.turnstileToken.trim()
        ? parsed.turnstileToken.trim()
        : undefined,
  }

  if (kind === 'prompt') {
    if (assets.length > 0) {
      throw validationFailed('提示词分享不能上传图片资产')
    }
    return manifest
  }

  if (assets.length === 0) {
    throw validationFailed('图任务分享必须包含图片资产')
  }
  if (!assets.some((asset) => asset.role === 'output')) {
    throw validationFailed('图任务分享至少需要一张输出图')
  }
  if (!isRecord(parsed.taskShare)) {
    throw validationFailed('图任务分享缺少 taskShare')
  }
  assertLineageItemsValid(parsed.taskShare.lineage)

  return manifest
}

function readFormFile(form: FormData, name: string): File {
  const value = form.get(name)
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as File).name !== 'string' ||
    typeof (value as File).size !== 'number' ||
    typeof (value as File).arrayBuffer !== 'function'
  ) {
    throw validationFailed(`缺少文件字段 ${name}`)
  }
  return value as File
}

function assertFileAllowed(file: File, maxBytes: number, label: string): void {
  const contentType = file.type.toLowerCase()
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw unsupportedMediaType(`${label} 类型不支持：${file.type || 'unknown'}`)
  }
  if (file.size <= 0) {
    throw validationFailed(`${label} 内容为空`)
  }
  if (file.size > maxBytes) {
    throw payloadTooLarge(`${label} 超过大小限制`)
  }
}

function normalizeUploadedAssets(env: Env, form: FormData, manifest: ShareManifest): UploadedAsset[] {
  const config = getConfig(env)
  const assets = manifest.assets ?? []
  const uploadedAssets = assets.map((asset) => {
    const original = readFormFile(form, `asset:${asset.clientAssetId}:original`)
    const thumbnail = readFormFile(form, `asset:${asset.clientAssetId}:thumb`)
    assertFileAllowed(original, config.maxImageBytes, '原图')
    assertFileAllowed(thumbnail, config.maxThumbBytes, '缩略图')
    if (original.size !== asset.byteSize) {
      throw validationFailed(`图片 ${asset.clientAssetId} 的 byteSize 与上传文件不一致`)
    }

    return {
      manifest: asset,
      original,
      thumbnail,
    }
  })

  const totalBytes = uploadedAssets.reduce(
    (sum, asset) => sum + asset.original.size + asset.thumbnail.size,
    0,
  )
  if (totalBytes > config.maxRequestBytes) {
    throw payloadTooLarge('单次分享上传内容超过总大小限制')
  }

  return uploadedAssets
}

export async function readCreateShareRequest(env: Env, request: Request): Promise<{
  manifest: ShareManifest
  assets: UploadedAsset[]
}> {
  const config = getConfig(env)
  const contentLength = Number(request.headers.get('Content-Length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > config.maxRequestBytes) {
    throw payloadTooLarge('请求体超过大小限制')
  }

  const contentType = request.headers.get('Content-Type') ?? ''
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    throw unsupportedMediaType('创建分享必须使用 multipart/form-data')
  }

  const form = await request.formData()
  const rawManifest = form.get('manifest')
  if (typeof rawManifest !== 'string') {
    throw badRequest('缺少 manifest 字段')
  }

  const manifest = parseManifest(rawManifest)
  return {
    manifest,
    assets: normalizeUploadedAssets(env, form, manifest),
  }
}

export async function readJsonBody<T extends object>(request: Request): Promise<T> {
  try {
    const body = await request.json()
    if (!isRecord(body)) {
      throw badRequest('请求体必须是 JSON 对象')
    }
    return body as T
  } catch (error) {
    if (error instanceof Response) throw error
    throw badRequest('请求体不是合法 JSON')
  }
}
