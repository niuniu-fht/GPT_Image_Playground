export const DEFAULT_PROVIDER_NAME = '供应商 1'
export const RECYCLE_BIN_RETENTION_MS = 24 * 60 * 60 * 1000
export const RECYCLE_BIN_RETENTION_DAYS = Math.round(RECYCLE_BIN_RETENTION_MS / (24 * 60 * 60 * 1000))
export const RECYCLE_BIN_POLL_INTERVAL_MS = 10 * 60 * 1000
export const ERROR_LOG_RETENTION_MS = 15 * 24 * 60 * 60 * 1000
export const ERROR_LOG_POLL_INTERVAL_MS = 12 * 60 * 60 * 1000

let uid = 0

export function genId(): string {
  return Date.now().toString(36) + (++uid).toString(36) + Math.random().toString(36).slice(2, 6)
}

// 画廊建议上限：超过后提示用户清理（约 5MB/张 ≈ 1GB 本地占用）
export const GALLERY_SUGGESTED_MAX_TASKS = 200
// 清理提醒一次建议移入回收站的数量
export const GALLERY_CLEANUP_BATCH_SIZE = 100
