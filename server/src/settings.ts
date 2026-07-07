import { env } from './env.js'
import { prisma } from './prisma.js'

export interface PlatformSettings {
  registerEnabled: boolean
  generationEnabled: boolean
  registerBonusCredits: number
  maintenanceMessage: string
  redeemDescription: string
  landingHeroSlidesJson: string
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
  registerBonusCredits: env.registerBonusCredits,
  maintenanceMessage: '',
  redeemDescription: '活动码和客服补偿码会立即到账，并写入积分流水。',
  landingHeroSlidesJson: JSON.stringify(defaultLandingHeroSlides, null, 2),
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback
  return value === 'true'
}

function parseNumber(value: string | undefined, fallback: number) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const rows = await prisma.platformSetting.findMany()
  const map = new Map(rows.map((row) => [row.key, row.value]))
  return {
    registerEnabled: parseBoolean(map.get('registerEnabled'), defaultPlatformSettings.registerEnabled),
    generationEnabled: parseBoolean(map.get('generationEnabled'), defaultPlatformSettings.generationEnabled),
    registerBonusCredits: parseNumber(map.get('registerBonusCredits'), defaultPlatformSettings.registerBonusCredits),
    maintenanceMessage: map.get('maintenanceMessage') ?? defaultPlatformSettings.maintenanceMessage,
    redeemDescription: map.get('redeemDescription') ?? defaultPlatformSettings.redeemDescription,
    landingHeroSlidesJson: map.get('landingHeroSlidesJson') ?? defaultPlatformSettings.landingHeroSlidesJson,
  }
}

export async function upsertPlatformSettings(input: Partial<PlatformSettings>) {
  const entries: Array<[keyof PlatformSettings, string]> = []
  if (typeof input.registerEnabled === 'boolean') entries.push(['registerEnabled', String(input.registerEnabled)])
  if (typeof input.generationEnabled === 'boolean') entries.push(['generationEnabled', String(input.generationEnabled)])
  if (typeof input.registerBonusCredits === 'number') entries.push(['registerBonusCredits', String(input.registerBonusCredits)])
  if (typeof input.maintenanceMessage === 'string') entries.push(['maintenanceMessage', input.maintenanceMessage])
  if (typeof input.redeemDescription === 'string') entries.push(['redeemDescription', input.redeemDescription])
  if (typeof input.landingHeroSlidesJson === 'string') entries.push(['landingHeroSlidesJson', input.landingHeroSlidesJson])

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
    ['registerBonusCredits', String(input.registerBonusCredits)],
    ['maintenanceMessage', input.maintenanceMessage],
    ['redeemDescription', input.redeemDescription],
    ['landingHeroSlidesJson', input.landingHeroSlidesJson],
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
