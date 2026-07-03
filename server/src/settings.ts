import { env } from './env.js'
import { prisma } from './prisma.js'

export interface PlatformSettings {
  registerEnabled: boolean
  generationEnabled: boolean
  registerBonusCredits: number
  maintenanceMessage: string
}

export const defaultPlatformSettings: PlatformSettings = {
  registerEnabled: true,
  generationEnabled: true,
  registerBonusCredits: env.registerBonusCredits,
  maintenanceMessage: '',
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
  }
}

export async function upsertPlatformSettings(input: Partial<PlatformSettings>) {
  const entries: Array<[keyof PlatformSettings, string]> = []
  if (typeof input.registerEnabled === 'boolean') entries.push(['registerEnabled', String(input.registerEnabled)])
  if (typeof input.generationEnabled === 'boolean') entries.push(['generationEnabled', String(input.generationEnabled)])
  if (typeof input.registerBonusCredits === 'number') entries.push(['registerBonusCredits', String(input.registerBonusCredits)])
  if (typeof input.maintenanceMessage === 'string') entries.push(['maintenanceMessage', input.maintenanceMessage])

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
