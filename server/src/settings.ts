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
  r2UploadEnabled: boolean
  r2UploadWindowEnabled: boolean
  r2UploadWindowStart: string
  r2UploadWindowEnd: string
  r2HubUrl: string
  r2HubApiKey: string
  chatEnabled: boolean
  chatProviderId: string
  chatModel: string
  chatSystemPrompt: string
  chatMaxRequestsPerMinute: number
  chatCostCredits: number
  chatFreePromotionEnabled: boolean
}

export interface AdminPlatformSettingsView extends Omit<PlatformSettings, 'sub2apiRedeemToken' | 'r2HubApiKey'> {
  sub2apiRedeemTokenConfigured: boolean
  r2HubApiKeyConfigured: boolean
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

export const defaultChatSystemPrompt = [
  '你是造境 Proxima 的 AI 提示词助手，专注于 AI 绘画提示词的创作与优化。',
  '你的能力：',
  '1. 把用户粗糙的描述扩写成高质量生图提示词（补充主体细节、风格、光线、构图、画质词）。',
  '2. 根据用户上传的图片反推提示词（描述主体、风格、光线、色彩、构图、画质关键词）。',
  '3. 中英互译提示词，保留专业术语。',
  '回答默认使用中文。当用户指令要求只输出提示词本身时，严格遵照该指令执行，不要附加解释。',
  '保持简洁实用。',
].join('\n')

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
  r2UploadEnabled: false,
  r2UploadWindowEnabled: false,
  r2UploadWindowStart: '19:00',
  r2UploadWindowEnd: '07:00',
  r2HubUrl: env.r2HubUrl,
  r2HubApiKey: env.r2HubApiKey,
  chatEnabled: false,
  chatProviderId: '',
  chatModel: '',
  chatSystemPrompt: defaultChatSystemPrompt,
  chatMaxRequestsPerMinute: 20,
  chatCostCredits: 1,
  chatFreePromotionEnabled: true,
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

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const BEIJING_UTC_OFFSET_MS = 8 * 60 * 60 * 1000

export function normalizeTimeString(value: string, fallback: string): string {
  const trimmed = value.trim()
  return TIME_PATTERN.test(trimmed) ? trimmed : fallback
}

/** 服务器容器多为 UTC，上传窗口统一按北京时间（UTC+8）折算。 */
export function beijingMinutesOfDay(now: Date): number {
  const shifted = (now.getTime() + BEIJING_UTC_OFFSET_MS) % 86_400_000
  return Math.floor(shifted / 60_000)
}

function windowRangeMinutes(start: string, end: string): { startMinutes: number; endMinutes: number } {
  const toMinutes = (value: string) => normalizeTimeString(value, '00:00')
    .split(':')
    .reduce((sum, part) => sum * 60 + Number(part), 0)
  return { startMinutes: toMinutes(start), endMinutes: toMinutes(end) }
}

/** 判断北京时间分钟数是否在 [start, end) 窗口内；start === end 视为全天开放；支持跨天窗口。 */
export function isWithinWindowMinutes(minutesOfDay: number, start: string, end: string): boolean {
  const { startMinutes, endMinutes } = windowRangeMinutes(start, end)
  if (startMinutes === endMinutes) return true
  if (startMinutes < endMinutes) {
    return minutesOfDay >= startMinutes && minutesOfDay < endMinutes
  }
  return minutesOfDay >= startMinutes || minutesOfDay < endMinutes
}

/** 判断当前时间是否在上传窗口内（窗口按北京时间解释，支持跨天）。 */
export function isWithinTimeWindow(now: Date, start: string, end: string): boolean {
  return isWithinWindowMinutes(beijingMinutesOfDay(now), start, end)
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
    r2UploadEnabled: parseBoolean(map.get('r2UploadEnabled'), defaultPlatformSettings.r2UploadEnabled),
    r2UploadWindowEnabled: parseBoolean(map.get('r2UploadWindowEnabled'), defaultPlatformSettings.r2UploadWindowEnabled),
    r2UploadWindowStart: normalizeTimeString(map.get('r2UploadWindowStart') ?? '', defaultPlatformSettings.r2UploadWindowStart),
    r2UploadWindowEnd: normalizeTimeString(map.get('r2UploadWindowEnd') ?? '', defaultPlatformSettings.r2UploadWindowEnd),
    r2HubUrl: map.get('r2HubUrl') ?? defaultPlatformSettings.r2HubUrl,
    r2HubApiKey: map.get('r2HubApiKey') ?? defaultPlatformSettings.r2HubApiKey,
    chatEnabled: parseBoolean(map.get('chatEnabled'), defaultPlatformSettings.chatEnabled),
    chatProviderId: map.get('chatProviderId') ?? defaultPlatformSettings.chatProviderId,
    chatModel: map.get('chatModel') ?? defaultPlatformSettings.chatModel,
    chatSystemPrompt: map.get('chatSystemPrompt') ?? defaultPlatformSettings.chatSystemPrompt,
    chatMaxRequestsPerMinute: Math.max(
      0,
      Math.round(parseNumber(map.get('chatMaxRequestsPerMinute'), defaultPlatformSettings.chatMaxRequestsPerMinute)),
    ),
    chatCostCredits: Math.max(0, Math.round(parseNumber(map.get('chatCostCredits'), defaultPlatformSettings.chatCostCredits))),
    chatFreePromotionEnabled: parseBoolean(map.get('chatFreePromotionEnabled'), defaultPlatformSettings.chatFreePromotionEnabled),
  }
}

export function toAdminPlatformSettingsView(settings: PlatformSettings): AdminPlatformSettingsView {
  const { sub2apiRedeemToken, r2HubApiKey, ...view } = settings
  return {
    ...view,
    sub2apiRedeemTokenConfigured: Boolean(sub2apiRedeemToken),
    r2HubApiKeyConfigured: Boolean(r2HubApiKey),
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
  if (typeof input.r2UploadEnabled === 'boolean') entries.push(['r2UploadEnabled', String(input.r2UploadEnabled)])
  if (typeof input.r2UploadWindowEnabled === 'boolean') entries.push(['r2UploadWindowEnabled', String(input.r2UploadWindowEnabled)])
  if (typeof input.r2UploadWindowStart === 'string') entries.push(['r2UploadWindowStart', normalizeTimeString(input.r2UploadWindowStart, defaultPlatformSettings.r2UploadWindowStart)])
  if (typeof input.r2UploadWindowEnd === 'string') entries.push(['r2UploadWindowEnd', normalizeTimeString(input.r2UploadWindowEnd, defaultPlatformSettings.r2UploadWindowEnd)])
  if (typeof input.r2HubUrl === 'string') entries.push(['r2HubUrl', input.r2HubUrl.trim()])
  if (typeof input.r2HubApiKey === 'string') entries.push(['r2HubApiKey', input.r2HubApiKey])
  if (typeof input.chatEnabled === 'boolean') entries.push(['chatEnabled', String(input.chatEnabled)])
  if (typeof input.chatProviderId === 'string') entries.push(['chatProviderId', input.chatProviderId.trim()])
  if (typeof input.chatModel === 'string') entries.push(['chatModel', input.chatModel.trim()])
  if (typeof input.chatSystemPrompt === 'string') entries.push(['chatSystemPrompt', input.chatSystemPrompt])
  if (typeof input.chatMaxRequestsPerMinute === 'number') {
    entries.push(['chatMaxRequestsPerMinute', String(Math.max(0, Math.round(input.chatMaxRequestsPerMinute)))])
  }
  if (typeof input.chatCostCredits === 'number') {
    entries.push(['chatCostCredits', String(Math.max(0, Math.round(input.chatCostCredits)))])
  }
  if (typeof input.chatFreePromotionEnabled === 'boolean') entries.push(['chatFreePromotionEnabled', String(input.chatFreePromotionEnabled)])

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
    ['r2UploadEnabled', String(input.r2UploadEnabled)],
    ['r2UploadWindowEnabled', String(input.r2UploadWindowEnabled)],
    ['r2UploadWindowStart', normalizeTimeString(input.r2UploadWindowStart, defaultPlatformSettings.r2UploadWindowStart)],
    ['r2UploadWindowEnd', normalizeTimeString(input.r2UploadWindowEnd, defaultPlatformSettings.r2UploadWindowEnd)],
    ['r2HubUrl', input.r2HubUrl],
    ['r2HubApiKey', input.r2HubApiKey],
    ['chatEnabled', String(input.chatEnabled)],
    ['chatProviderId', input.chatProviderId],
    ['chatModel', input.chatModel],
    ['chatSystemPrompt', input.chatSystemPrompt],
    ['chatMaxRequestsPerMinute', String(input.chatMaxRequestsPerMinute)],
    ['chatCostCredits', String(input.chatCostCredits)],
    ['chatFreePromotionEnabled', String(input.chatFreePromotionEnabled)],
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
