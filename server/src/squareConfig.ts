import { env } from './env.js'
import { prisma } from './prisma.js'

export interface SquareRuntimeConfig {
  squareApiUrl: string
  squareAdminToken: string
  r2Enabled: boolean
  r2Endpoint: string
  r2AccessKey: string
  r2SecretKey: string
  r2Bucket: string
  publicBaseUrl: string
  autoUploadGeneratedImages: boolean
}

export interface SquareAdminConfigView {
  squareApiUrl: string
  squareAdminTokenConfigured: boolean
  r2Enabled: boolean
  r2Endpoint: string
  r2AccessKey: string
  r2SecretKeyConfigured: boolean
  r2Bucket: string
  publicBaseUrl: string
  autoUploadGeneratedImages: boolean
}

export interface SquareAdminConfigInput {
  squareApiUrl?: string
  squareAdminToken?: string
  r2Enabled?: boolean
  r2Endpoint?: string
  r2AccessKey?: string
  r2SecretKey?: string
  r2Bucket?: string
  publicBaseUrl?: string
  autoUploadGeneratedImages?: boolean
}

const DEFAULT_PUBLIC_BASE_URL = 'https://assets.code2alita.com'
const DEFAULT_R2_ENDPOINT = 'https://bd5b6704fc3b38f283701e1cfc064918.r2.cloudflarestorage.com'
const DEFAULT_R2_BUCKET = 'max-canvas'

export const defaultSquareRuntimeConfig: SquareRuntimeConfig = {
  squareApiUrl: env.squareApiUrl,
  squareAdminToken: env.squareAdminToken,
  r2Enabled: true,
  r2Endpoint: env.r2Endpoint || DEFAULT_R2_ENDPOINT,
  r2AccessKey: env.r2AccessKey,
  r2SecretKey: env.r2SecretKey,
  r2Bucket: env.r2Bucket || DEFAULT_R2_BUCKET,
  publicBaseUrl: env.r2PublicBaseUrl || DEFAULT_PUBLIC_BASE_URL,
  autoUploadGeneratedImages: false,
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  return value === 'true'
}

function readString(map: Map<string, string>, key: keyof SquareRuntimeConfig): string {
  return map.get(`square.${key}`) ?? String(defaultSquareRuntimeConfig[key] ?? '')
}

function maskKey(value: string): string {
  if (!value) return ''
  if (value.length <= 8) return '已配置'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

export async function getSquareRuntimeConfig(): Promise<SquareRuntimeConfig> {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { startsWith: 'square.' } },
  })
  const map = new Map(rows.map((row) => [row.key, row.value]))
  return {
    squareApiUrl: readString(map, 'squareApiUrl').replace(/\/+$/, ''),
    squareAdminToken: readString(map, 'squareAdminToken'),
    r2Enabled: parseBoolean(map.get('square.r2Enabled'), defaultSquareRuntimeConfig.r2Enabled),
    r2Endpoint: readString(map, 'r2Endpoint').replace(/\/+$/, ''),
    r2AccessKey: readString(map, 'r2AccessKey'),
    r2SecretKey: readString(map, 'r2SecretKey'),
    r2Bucket: readString(map, 'r2Bucket'),
    publicBaseUrl: readString(map, 'publicBaseUrl').replace(/\/+$/, ''),
    autoUploadGeneratedImages: parseBoolean(
      map.get('square.autoUploadGeneratedImages'),
      defaultSquareRuntimeConfig.autoUploadGeneratedImages,
    ),
  }
}

export function toSquareAdminConfigView(config: SquareRuntimeConfig): SquareAdminConfigView {
  return {
    squareApiUrl: config.squareApiUrl,
    squareAdminTokenConfigured: Boolean(config.squareAdminToken),
    r2Enabled: config.r2Enabled,
    r2Endpoint: config.r2Endpoint,
    r2AccessKey: maskKey(config.r2AccessKey),
    r2SecretKeyConfigured: Boolean(config.r2SecretKey),
    r2Bucket: config.r2Bucket,
    publicBaseUrl: config.publicBaseUrl,
    autoUploadGeneratedImages: config.autoUploadGeneratedImages,
  }
}

export async function upsertSquareRuntimeConfig(input: SquareAdminConfigInput): Promise<SquareRuntimeConfig> {
  const current = await getSquareRuntimeConfig()
  const next: SquareRuntimeConfig = {
    ...current,
    ...input,
    squareApiUrl: input.squareApiUrl?.trim().replace(/\/+$/, '') ?? current.squareApiUrl,
    squareAdminToken: input.squareAdminToken?.trim() || current.squareAdminToken,
    r2Endpoint: input.r2Endpoint?.trim().replace(/\/+$/, '') ?? current.r2Endpoint,
    r2AccessKey: input.r2AccessKey?.trim() || current.r2AccessKey,
    r2SecretKey: input.r2SecretKey?.trim() || current.r2SecretKey,
    r2Bucket: input.r2Bucket?.trim() ?? current.r2Bucket,
    publicBaseUrl: input.publicBaseUrl?.trim().replace(/\/+$/, '') ?? current.publicBaseUrl,
  }

  const entries: Array<[keyof SquareRuntimeConfig, string]> = [
    ['squareApiUrl', next.squareApiUrl],
    ['squareAdminToken', next.squareAdminToken],
    ['r2Enabled', String(next.r2Enabled)],
    ['r2Endpoint', next.r2Endpoint],
    ['r2AccessKey', next.r2AccessKey],
    ['r2SecretKey', next.r2SecretKey],
    ['r2Bucket', next.r2Bucket],
    ['publicBaseUrl', next.publicBaseUrl],
    ['autoUploadGeneratedImages', String(next.autoUploadGeneratedImages)],
  ]

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.platformSetting.upsert({
        where: { key: `square.${key}` },
        update: { value },
        create: { key: `square.${key}`, value },
      }),
    ),
  )

  return getSquareRuntimeConfig()
}

export async function seedMissingSquareRuntimeConfig(input: SquareRuntimeConfig): Promise<SquareRuntimeConfig> {
  const entries: Array<[keyof SquareRuntimeConfig, string]> = [
    ['squareApiUrl', input.squareApiUrl],
    ['squareAdminToken', input.squareAdminToken],
    ['r2Enabled', String(input.r2Enabled)],
    ['r2Endpoint', input.r2Endpoint],
    ['r2AccessKey', input.r2AccessKey],
    ['r2SecretKey', input.r2SecretKey],
    ['r2Bucket', input.r2Bucket],
    ['publicBaseUrl', input.publicBaseUrl],
    ['autoUploadGeneratedImages', String(input.autoUploadGeneratedImages)],
  ]

  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: entries.map(([key]) => `square.${key}`) } },
  })
  const existing = new Map(rows.map((row) => [row.key, row.value]))
  const operations = entries.flatMap(([key, value]) => {
    const settingKey = `square.${key}`
    const currentValue = existing.get(settingKey)
    if (currentValue === undefined) {
      return [prisma.platformSetting.create({ data: { key: settingKey, value } })]
    }
    const shouldBackfillEmptyString =
      key !== 'r2Enabled' &&
      key !== 'autoUploadGeneratedImages' &&
      currentValue === '' &&
      value !== ''
    if (shouldBackfillEmptyString) {
      return [prisma.platformSetting.update({ where: { key: settingKey }, data: { value } })]
    }
    return []
  })

  if (operations.length > 0) {
    await prisma.$transaction(operations)
  }

  return getSquareRuntimeConfig()
}
