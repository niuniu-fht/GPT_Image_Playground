import { getPlatformSettings, isWithinTimeWindow } from '../settings.js'

const R2_URL_PATTERN = /^https:\/\/(pre|pub)/i

/** 判断图片 URL 是否已经在 R2 上（r2hub 桶池的公网域名以 https://pre 或 https://pub 开头）。 */
export function isAlreadyOnR2(dataUrl: string): boolean {
  return R2_URL_PATTERN.test(dataUrl)
}

/**
 * 判断一张生成图是否需要上传 R2：
 * 已在 R2（pre/pub 前缀）或空值的不需要，其余（本地交付地址、远程 URL、base64）都需要。
 */
export function needsR2Upload(dataUrl: string | undefined | null): dataUrl is string {
  if (!dataUrl) return false
  if (isAlreadyOnR2(dataUrl)) return false
  return /^(https?:\/\/|\/api\/generations\/|data:image\/)/i.test(dataUrl)
}

export interface R2UploadRuntimeConfig {
  enabled: boolean
  windowEnabled: boolean
  inWindow: boolean
  windowStart: string
  windowEnd: string
  hubUrl: string
  hubApiKeyConfigured: boolean
}

export async function getR2UploadRuntimeConfig(now = new Date()): Promise<R2UploadRuntimeConfig> {
  const settings = await getPlatformSettings()
  const windowStart = settings.r2UploadWindowStart
  const windowEnd = settings.r2UploadWindowEnd
  return {
    enabled: settings.r2UploadEnabled,
    windowEnabled: settings.r2UploadWindowEnabled,
    inWindow: settings.r2UploadWindowEnabled ? isWithinTimeWindow(now, windowStart, windowEnd) : true,
    windowStart,
    windowEnd,
    hubUrl: settings.r2HubUrl,
    hubApiKeyConfigured: Boolean(settings.r2HubApiKey),
  }
}

/** 当前是否允许执行 R2 上传（总开关 + 时间段窗口）。 */
export async function isR2UploadActive(now = new Date()): Promise<boolean> {
  const config = await getR2UploadRuntimeConfig(now)
  return config.enabled && config.inWindow
}
