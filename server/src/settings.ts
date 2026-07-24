import { env } from './env.js'
import { prisma } from './prisma.js'

export interface PlatformSettings {
  registerEnabled: boolean
  generationEnabled: boolean
  generationTimeoutSeconds: number
  registerBonusCredits: number
  maintenanceMessage: string
  redeemDescription: string
  landingHeroSlidesJson: string
  sub2apiRedeemEnabled: boolean
  sub2apiRedeemBaseUrl: string
  sub2apiRedeemToken: string
}

export interface AdminPlatformSettingsView extends Omit<PlatformSettings, 'sub2apiRedeemToken'> {
  sub2apiRedeemTokenConfigured: boolean
}

export const defaultLandingHeroSlides = [
  {
    id: 'portrait-office',
    title: '职业头像套图',
    category: '人像写真',
    imageUrl: '/landing/showcase/portrait-office.png',
    accent: '#2563eb',
  },
  {
    id: 'headphone-product',
    title: '耳机产品主图',
    category: '电商主图',
    imageUrl: '/landing/showcase/headphone-product.png',
    accent: '#0f766e',
  },
  {
    id: 'perfume-product',
    title: '香水电商大片',
    category: '产品棚拍',
    imageUrl: '/landing/showcase/perfume-product.png',
    accent: '#b45309',
  },
  {
    id: 'travel-portrait',
    title: '旅行人像换景',
    category: '场景生成',
    imageUrl: '/landing/showcase/travel-portrait.png',
    accent: '#dc2626',
  },
  {
    id: 'fashion-street',
    title: '街拍穿搭海报',
    category: '服装换装',
    imageUrl: '/landing/showcase/fashion-street.png',
    accent: '#7c3aed',
  },
] satisfies Array<{ id: string; title: string; category: string; imageUrl: string; accent: string }>

export const defaultPlatformSettings: PlatformSettings = {
  registerEnabled: true,
  generationEnabled: true,
  generationTimeoutSeconds: 300,
  registerBonusCredits: env.registerBonusCredits,
  maintenanceMessage: '',
  redeemDescription: '活动码和客服补偿码会立即到账，并写入积分流水。',
  landingHeroSlidesJson: JSON.stringify(defaultLandingHeroSlides, null, 2),
  sub2apiRedeemEnabled: false,
  sub2apiRedeemBaseUrl: '',
  sub2apiRedeemToken: '',
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback
  return value === 'true'
}

function parseNumber(value: string | undefined, fallback: number) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

export function normalizeGenerationTimeoutSeconds(value: number): number {
  if (!Number.isFinite(value)) {
    return defaultPlatformSettings.generationTimeoutSeconds
  }
  return Math.min(1800, Math.max(30, Math.floor(value)))
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const rows = await prisma.platformSetting.findMany()
  const map = new Map(rows.map((row) => [row.key, row.value]))
  return {
    registerEnabled: parseBoolean(map.get('registerEnabled'), defaultPlatformSettings.registerEnabled),
    generationEnabled: parseBoolean(map.get('generationEnabled'), defaultPlatformSettings.generationEnabled),
    generationTimeoutSeconds: normalizeGenerationTimeoutSeconds(
      parseNumber(map.get('generationTimeoutSeconds'), defaultPlatformSettings.generationTimeoutSeconds),
    ),
    registerBonusCredits: parseNumber(map.get('registerBonusCredits'), defaultPlatformSettings.registerBonusCredits),
    maintenanceMessage: map.get('maintenanceMessage') ?? defaultPlatformSettings.maintenanceMessage,
    redeemDescription: map.get('redeemDescription') ?? defaultPlatformSettings.redeemDescription,
    landingHeroSlidesJson: map.get('landingHeroSlidesJson') ?? defaultPlatformSettings.landingHeroSlidesJson,
    sub2apiRedeemEnabled: parseBoolean(map.get('sub2apiRedeemEnabled'), defaultPlatformSettings.sub2apiRedeemEnabled),
    sub2apiRedeemBaseUrl: map.get('sub2apiRedeemBaseUrl')
      ?? map.get('sub2apiRedeemConsumeUrl')
      ?? defaultPlatformSettings.sub2apiRedeemBaseUrl,
    sub2apiRedeemToken: map.get('sub2apiRedeemToken') ?? defaultPlatformSettings.sub2apiRedeemToken,
  }
}

export function toAdminPlatformSettingsView(settings: PlatformSettings): AdminPlatformSettingsView {
  const { sub2apiRedeemToken, ...view } = settings
  return {
    ...view,
    sub2apiRedeemTokenConfigured: Boolean(sub2apiRedeemToken),
  }
}

export async function upsertPlatformSettings(input: Partial<PlatformSettings>) {
  const entries: Array<[keyof PlatformSettings, string]> = []
  if (typeof input.registerEnabled === 'boolean') entries.push(['registerEnabled', String(input.registerEnabled)])
  if (typeof input.generationEnabled === 'boolean') entries.push(['generationEnabled', String(input.generationEnabled)])
  if (typeof input.generationTimeoutSeconds === 'number') entries.push(['generationTimeoutSeconds', String(normalizeGenerationTimeoutSeconds(input.generationTimeoutSeconds))])
  if (typeof input.registerBonusCredits === 'number') entries.push(['registerBonusCredits', String(input.registerBonusCredits)])
  if (typeof input.maintenanceMessage === 'string') entries.push(['maintenanceMessage', input.maintenanceMessage])
  if (typeof input.redeemDescription === 'string') entries.push(['redeemDescription', input.redeemDescription])
  if (typeof input.landingHeroSlidesJson === 'string') entries.push(['landingHeroSlidesJson', input.landingHeroSlidesJson])
  if (typeof input.sub2apiRedeemEnabled === 'boolean') entries.push(['sub2apiRedeemEnabled', String(input.sub2apiRedeemEnabled)])
  if (typeof input.sub2apiRedeemBaseUrl === 'string') entries.push(['sub2apiRedeemBaseUrl', input.sub2apiRedeemBaseUrl])
  if (typeof input.sub2apiRedeemToken === 'string') entries.push(['sub2apiRedeemToken', input.sub2apiRedeemToken])

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.platformSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    ),
  )
  return getPlatformSettings()
}

export async function seedMissingPlatformSettings(input: PlatformSettings) {
  const entries: Array<[keyof PlatformSettings, string]> = [
    ['registerEnabled', String(input.registerEnabled)],
    ['generationEnabled', String(input.generationEnabled)],
    ['generationTimeoutSeconds', String(normalizeGenerationTimeoutSeconds(input.generationTimeoutSeconds))],
    ['registerBonusCredits', String(input.registerBonusCredits)],
    ['maintenanceMessage', input.maintenanceMessage],
    ['redeemDescription', input.redeemDescription],
    ['landingHeroSlidesJson', input.landingHeroSlidesJson],
    ['sub2apiRedeemEnabled', String(input.sub2apiRedeemEnabled)],
    ['sub2apiRedeemBaseUrl', input.sub2apiRedeemBaseUrl],
    ['sub2apiRedeemToken', input.sub2apiRedeemToken],
  ]
  const existingRows = await prisma.platformSetting.findMany({
    where: { key: { in: entries.map(([key]) => key) } },
    select: { key: true },
  })
  const existingKeys = new Set(existingRows.map((row) => row.key))
  const missingEntries = entries.filter(([key]) => !existingKeys.has(key))

  if (missingEntries.length > 0) {
    await prisma.$transaction(
      missingEntries.map(([key, value]) =>
        prisma.platformSetting.create({
          data: { key, value },
        }),
      ),
    )
  }

  return getPlatformSettings()
}
