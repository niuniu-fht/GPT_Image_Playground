export interface Env {
  DB: D1Database
  IMAGES: R2Bucket
  API_VERSION?: string
  ALLOWED_ORIGINS?: string
  DEFAULT_SHARE_STATUS?: string
  MAX_IMAGE_BYTES?: string
  MAX_THUMB_BYTES?: string
  MAX_REQUEST_BYTES?: string
  DAILY_MEDIA_SHARE_LIMIT?: string
  DAILY_PROMPT_SHARE_LIMIT?: string
  PUBLISHER_SHARE_RATE_LIMIT_PER_MINUTE?: string
  IP_SHARE_RATE_LIMIT_PER_MINUTE?: string
  IP_IDENTITY_RATE_LIMIT_PER_HOUR?: string
  AUTO_HIDE_REPORT_THRESHOLD?: string
  REQUIRE_TURNSTILE?: string
  MAX_R2_STORAGE_BYTES?: string
  CLEANUP_TARGET_R2_STORAGE_BYTES?: string
  MAX_PUBLISHED_SHARES?: string
  MAX_STORED_SHARES?: string
  CLEANUP_BATCH_LIMIT?: string
  CLEANUP_DELETED_RETENTION_DAYS?: string
  CLEANUP_HIDDEN_RETENTION_DAYS?: string
  CLEANUP_PUBLISHED_MEDIA_RETENTION_DAYS?: string
  CLEANUP_PRUNE_PUBLISHED?: string
  TOKEN_HASH_SECRET?: string
  TURNSTILE_SECRET_KEY?: string
  ADMIN_TOKEN?: string
}

export interface RequestContext {
  env: Env
  request: Request
  requestId: string
  corsHeaders: HeadersInit
}

export type ShareKind = 'image' | 'task' | 'prompt'
export type ShareStatus = 'published' | 'pending_review' | 'hidden' | 'deleted' | 'rejected'
export type AssetRole = 'output' | 'origin_input'

export interface Publisher {
  id: string
  status: 'active' | 'blocked'
}

export interface ManifestAsset {
  clientAssetId: string
  role: AssetRole
  localImageId?: string
  mimeType: string
  width?: number | null
  height?: number | null
  byteSize: number
  standaloneShareAllowed?: boolean
}

export interface ShareManifest {
  kind: ShareKind
  clientRequestId: string
  title: string
  prompt: string
  tags?: string[]
  source?: {
    app?: string
    schemaVersion?: number
  }
  taskShare?: {
    entryTaskId?: string
    entryOutputImageIds?: string[]
    lineage?: unknown[]
    originAssets?: Array<{
      clientAssetId: string
      role: AssetRole
      standaloneShareAllowed?: boolean
    }>
  }
  promptShare?: {
    localPromptId?: string | null
    createdAt?: number
    updatedAt?: number
  }
  assets?: ManifestAsset[]
  turnstileToken?: string
}

export interface UploadedAsset {
  manifest: ManifestAsset
  original: File
  thumbnail: File
}

export interface StoredAssetRow {
  id: string
  clientAssetId: string
  role: AssetRole
  r2Key: string
  thumbR2Key: string
  mimeType: string
  byteSize: number
  thumbByteSize: number
  width: number | null
  height: number | null
}
