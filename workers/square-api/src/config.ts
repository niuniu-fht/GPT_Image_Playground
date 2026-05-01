import type { Env, ShareStatus } from './types'

export interface SquareConfig {
  apiVersion: string
  allowedOrigins: string[]
  defaultShareStatus: ShareStatus
  maxImageBytes: number
  maxThumbBytes: number
  maxRequestBytes: number
  dailyMediaShareLimit: number
  dailyPromptShareLimit: number
  publisherShareRateLimitPerMinute: number
  ipShareRateLimitPerMinute: number
  ipIdentityRateLimitPerHour: number
  autoHideReportThreshold: number
  requireTurnstile: boolean
  maxR2StorageBytes: number
  cleanupTargetR2StorageBytes: number
  maxPublishedShares: number
  maxStoredShares: number
  cleanupBatchLimit: number
  cleanupDeletedRetentionDays: number
  cleanupHiddenRetentionDays: number
  cleanupPublishedMediaRetentionDays: number
  cleanupPrunePublished: boolean
}

const SHARE_STATUSES = new Set<ShareStatus>([
  'published',
  'pending_review',
  'hidden',
  'deleted',
  'rejected',
])

function readNumber(value: string | undefined, fallback: number, min = 0): number {
  if (value == null || value.trim() === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min) return fallback
  return Math.floor(parsed)
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') return fallback
  return value.trim().toLowerCase() === 'true'
}

function readShareStatus(value: string | undefined): ShareStatus {
  return SHARE_STATUSES.has(value as ShareStatus) ? (value as ShareStatus) : 'published'
}

function readOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

export function getConfig(env: Env): SquareConfig {
  const maxR2StorageBytes = readNumber(env.MAX_R2_STORAGE_BYTES, 9 * 1024 * 1024 * 1024, 1)
  const cleanupTargetR2StorageBytes = Math.min(
    readNumber(env.CLEANUP_TARGET_R2_STORAGE_BYTES, 8 * 1024 * 1024 * 1024, 1),
    maxR2StorageBytes,
  )

  return {
    apiVersion: env.API_VERSION?.trim() || 'v1',
    allowedOrigins: readOrigins(env.ALLOWED_ORIGINS),
    defaultShareStatus: readShareStatus(env.DEFAULT_SHARE_STATUS),
    maxImageBytes: readNumber(env.MAX_IMAGE_BYTES, 10 * 1024 * 1024, 1),
    maxThumbBytes: readNumber(env.MAX_THUMB_BYTES, 512 * 1024, 1),
    maxRequestBytes: readNumber(env.MAX_REQUEST_BYTES, 60 * 1024 * 1024, 1),
    dailyMediaShareLimit: readNumber(env.DAILY_MEDIA_SHARE_LIMIT, 3, 1),
    dailyPromptShareLimit: readNumber(env.DAILY_PROMPT_SHARE_LIMIT, 99, 1),
    publisherShareRateLimitPerMinute: readNumber(env.PUBLISHER_SHARE_RATE_LIMIT_PER_MINUTE, 2, 1),
    ipShareRateLimitPerMinute: readNumber(env.IP_SHARE_RATE_LIMIT_PER_MINUTE, 10, 1),
    ipIdentityRateLimitPerHour: readNumber(env.IP_IDENTITY_RATE_LIMIT_PER_HOUR, 20, 1),
    autoHideReportThreshold: readNumber(env.AUTO_HIDE_REPORT_THRESHOLD, 5, 1),
    requireTurnstile: readBoolean(env.REQUIRE_TURNSTILE, false),
    maxR2StorageBytes,
    cleanupTargetR2StorageBytes,
    maxPublishedShares: readNumber(env.MAX_PUBLISHED_SHARES, 3000, 1),
    maxStoredShares: readNumber(env.MAX_STORED_SHARES, 5000, 1),
    cleanupBatchLimit: readNumber(env.CLEANUP_BATCH_LIMIT, 50, 1),
    cleanupDeletedRetentionDays: readNumber(env.CLEANUP_DELETED_RETENTION_DAYS, 1, 0),
    cleanupHiddenRetentionDays: readNumber(env.CLEANUP_HIDDEN_RETENTION_DAYS, 30, 0),
    cleanupPublishedMediaRetentionDays: readNumber(env.CLEANUP_PUBLISHED_MEDIA_RETENTION_DAYS, 90, 0),
    cleanupPrunePublished: readBoolean(env.CLEANUP_PRUNE_PUBLISHED, true),
  }
}
