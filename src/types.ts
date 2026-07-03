import {
  UNCATEGORIZED_CATEGORY_NAME,
  UNKNOWN_TASK_PROVIDER_NAME,
} from './store/taskRecordConstants'
import { DEFAULT_PARAMS } from './store/taskParams'

// ===== 设置 =====

export interface AppSettings {
  baseUrl: string
  apiKey: string
  model: string
  responsesImageModel: string
  responsesTransport: ResponsesTransportMode
  responsesImageInputMode: ResponsesImageInputMode
  responsesPromptRevisionMode: ResponsesPromptRevisionMode
  timeout: number
  apiProtocol: ApiProtocol
  requestMode: RequestMode
}

export type ApiProtocol = 'images' | 'responses'
export type RequestMode = 'direct' | 'local_proxy'
export type ResponsesTransportMode = 'auto' | 'stream' | 'json'
export type ResponsesImageInputMode = 'auto' | 'file_id'
export type ResponsesPromptRevisionMode = 'allow' | 'compat'
export type TaskView = 'gallery' | 'trash'
export type GalleryDisplayMode = 'standard' | 'image'
export type AppView = 'local' | 'square'
export type SquareShareKind = 'image' | 'task' | 'prompt'
export type SquareShareStatus = 'published' | 'pending_review' | 'hidden' | 'deleted' | 'rejected'

export interface SquareShareAssetSummary {
  assetId: string
  clientAssetId?: string | null
  role?: 'output' | 'origin_input' | null
  thumbUrl?: string | null
  originalUrl?: string | null
  width?: number | null
  height?: number | null
}

export interface SquareShareSummary {
  id: string
  kind: SquareShareKind
  title: string
  prompt: string
  coverAsset?: SquareShareAssetSummary | null
  tags: string[]
  status?: SquareShareStatus
  createdAt: number
  viewCount?: number
}

export interface SquareShareDetail extends SquareShareSummary {
  manifest?: unknown
  assets?: SquareShareAssetSummary[]
}

export interface SquareListInput {
  kind: SquareShareKind
  sort?: 'latest'
  q?: string
  cursor?: string
  limit?: number
}

export interface SquareListResult {
  items: SquareShareSummary[]
  nextCursor: string | null
}

export interface SquareMySharesInput {
  q?: string
  cursor?: string
  limit?: number
}

export interface SquareIdentity {
  publisherId: string
  token: string
}

export interface SquarePromptShareTarget {
  kind: 'prompt'
  title?: string
  content: string
}

export interface SquareTaskShareTarget {
  kind: 'task'
  taskId: string
}

export type SquareShareTarget = SquarePromptShareTarget | SquareTaskShareTarget

export interface ImageEditSelection {
  x: number
  y: number
  width: number
  height: number
}

export interface ImageEditSession {
  taskId: string
  providerId: string | null
  sourceImageId: string
  sourceImageDataUrl: string
  sourceImageIds?: string[] | null
  lineageParentTaskId?: string | null
  lineageParentImageId?: string | null
  prompt: string
  params: TaskParams
  initialSelection?: ImageEditSelection | null
}

export interface ProviderConfig extends AppSettings {
  id: string
  name: string
}

export interface CurrentUser {
  id: string
  email: string
  role: 'user' | 'admin'
  status?: 'active' | 'disabled'
  creditBalance: number
}

export interface ModelConfig {
  id: string
  name: string
  displayName: string
  description: string
  icon: string
  costCredits: number
  upstreamModel: string
  upstreamProviderId?: string | null
  apiProtocol: ApiProtocol
  enabled: boolean
  isNew: boolean
  sortOrder: number
  createdAt?: string
  updatedAt?: string
  upstreamProvider?: {
    id: string
    name: string
    baseUrl: string
    enabled: boolean
    lastCheckedAt?: string | null
    lastHealthStatus: 'unknown' | 'healthy' | 'error'
    lastLatencyMs?: number | null
    lastHttpStatus?: number | null
    lastHealthMessage: string
  } | null
}

export interface AdminUserSummary {
  id: string
  email: string
  role: 'user' | 'admin'
  status: 'active' | 'disabled'
  segment: 'normal' | 'vip' | 'trial' | 'risk'
  adminNote: string
  creditBalance: number
  lastLoginAt?: string | null
  loginCount: number
  createdAt: string
  _count?: {
    tasks: number
    ledgers: number
  }
}

export interface AdminCreditLedger {
  id: string
  userId: string
  delta: number
  reason: string
  taskId?: string | null
  balanceAfter: number
  createdAt: string
  user?: { email: string }
}

export interface AdminRedeemCode {
  id: string
  code: string
  name: string
  credits: number
  maxRedemptions: number
  perUserLimit: number
  usedCount: number
  status: 'active' | 'disabled'
  startsAt?: string | null
  endsAt?: string | null
  note: string
  createdAt: string
  updatedAt: string
  _count?: {
    redemptions: number
  }
  redemptions?: Array<{
    id: string
    userId: string
    credits: number
    balanceAfter: number
    createdAt: string
    user?: { email: string }
  }>
}

export interface CreditPackage {
  id: string
  name: string
  description: string
  credits: number
  bonusCredits: number
  priceCents: number
  currency: string
  badge: string
  enabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  _count?: {
    orders: number
  }
}

export interface CreditOrder {
  id: string
  orderNo: string
  userId: string
  creditPackageId?: string | null
  packageName: string
  credits: number
  bonusCredits: number
  totalCredits: number
  priceCents: number
  currency: string
  status: 'pending' | 'paid' | 'cancelled'
  paymentMethod: string
  userNote: string
  adminNote: string
  paidAt?: string | null
  cancelledAt?: string | null
  createdAt: string
  updatedAt: string
  user?: {
    email: string
    status?: 'active' | 'disabled'
    segment?: 'normal' | 'vip' | 'trial' | 'risk'
  }
}

export interface SupportTicket {
  id: string
  userId: string
  category: 'general' | 'generation' | 'billing' | 'square' | 'account'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  title: string
  content: string
  contact: string
  relatedTaskId?: string | null
  relatedOrderNo?: string | null
  adminReply: string
  adminNote: string
  repliedAt?: string | null
  closedAt?: string | null
  createdAt: string
  updatedAt: string
  user?: {
    email: string
    status?: 'active' | 'disabled'
    segment?: 'normal' | 'vip' | 'trial' | 'risk'
  }
}

export interface ModerationRule {
  id: string
  name: string
  type: 'keyword' | 'regex'
  pattern: string
  action: 'block'
  message: string
  enabled: boolean
  priority: number
  hitCount: number
  lastHitAt?: string | null
  note: string
  createdAt: string
  updatedAt: string
}

export interface AdminUserDetail {
  user: AdminUserSummary & {
    updatedAt?: string
  }
  tasks: AdminGenerationTask[]
  ledgers: AdminCreditLedger[]
  loginLogs: AdminLoginLog[]
  creditOrders: CreditOrder[]
  supportTickets: SupportTicket[]
  auditLogs: AdminAuditLog[]
}

export interface AdminUpstreamProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  enabled: boolean
  priority: number
  timeoutSeconds: number
  notes: string
  lastCheckedAt?: string | null
  lastHealthStatus: 'unknown' | 'healthy' | 'error'
  lastLatencyMs?: number | null
  lastHttpStatus?: number | null
  lastHealthMessage: string
  createdAt?: string
  updatedAt?: string
  _count?: {
    models: number
  }
  models?: Array<{
    id: string
    displayName: string
    name: string
    enabled: boolean
    costCredits: number
  }>
}

export interface AdminUpstreamTestResult {
  ok: boolean
  status: number
  latencyMs: number
  checkedAt: string
  modelCount?: number
  message: string
}

export interface AdminAnnouncement {
  id: string
  title: string
  content: string
  level: 'info' | 'success' | 'warning' | 'critical'
  placement: 'global' | 'home' | 'workspace' | 'square'
  actionLabel: string
  actionUrl: string
  status: 'draft' | 'published' | 'archived'
  pinned: boolean
  startsAt?: string | null
  endsAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminGenerationTask {
  id: string
  prompt: string
  params?: unknown
  status: 'running' | 'done' | 'error'
  costCredits: number
  outputImages?: unknown
  error?: string | null
  createdAt: string
  finishedAt?: string | null
  user?: { email: string }
  modelConfig?: { displayName: string; name: string }
}

export interface AdminAuditLog {
  id: string
  actorId?: string | null
  actor?: {
    id: string
    email: string
    role: 'user' | 'admin'
    status: 'active' | 'disabled'
  } | null
  action: string
  target: string
  detail?: unknown
  ip?: string | null
  createdAt: string
}

export interface AdminLoginLog {
  id: string
  email: string
  userId?: string | null
  user?: {
    id: string
    email: string
    role: 'user' | 'admin'
    status: 'active' | 'disabled'
    segment: 'normal' | 'vip' | 'trial' | 'risk'
    creditBalance: number
    loginCount: number
    lastLoginAt?: string | null
    createdAt: string
  } | null
  success: boolean
  reason: 'login_success' | 'register_success' | 'unknown_email' | 'wrong_password' | 'account_disabled' | string
  ip?: string | null
  userAgent?: string | null
  createdAt: string
}

export interface AdminUsageReport {
  range: {
    from: string
    to: string
  }
  summary: {
    totalTasks: number
    doneTasks: number
    errorTasks: number
    runningTasks: number
    successRate: number
    errorRate: number
    credits: number
    activeUsers: number
  }
  trend: Array<{
    date: string
    tasks: number
    done: number
    error: number
    running: number
    credits: number
  }>
  modelUsage: Array<{
    modelConfigId: string
    displayName: string
    name: string
    upstreamModel: string
    upstreamProviderName: string
    enabled: boolean
    tasks: number
    credits: number
  }>
  providerUsage: Array<{
    providerId: string | null
    name: string
    baseUrl: string
    enabled: boolean
    health: 'unknown' | 'healthy' | 'error' | string
    tasks: number
    credits: number
    models: number
  }>
  userUsage: Array<{
    userId: string
    email: string
    segment: 'normal' | 'vip' | 'trial' | 'risk' | string
    status: 'active' | 'disabled' | string
    tasks: number
    credits: number
  }>
}

export interface AdminSquareUsage {
  storage: {
    estimatedBytes: number
    assetCount: number
    maxBytes: number
    percentOfMax: number
  }
  shares: {
    total: number
    published: number
    hidden: number
    deleted: number
    rejected: number
    pendingReview: number
    byKind: Record<SquareShareKind, number>
  }
  limits: {
    maxPublishedShares: number
    maxStoredShares: number
    cleanupBatchLimit: number
  }
}

export interface AdminSquareShare {
  id: string
  publisherId: string
  kind: SquareShareKind
  title: string
  prompt: string
  tags: string[]
  status: SquareShareStatus
  clientRequestId: string
  viewCount: number
  reportCount: number
  createdAt: number
  updatedAt: number
  coverAsset?: SquareShareAssetSummary | null
}

export interface AdminPlatformSettings {
  registerEnabled: boolean
  generationEnabled: boolean
  registerBonusCredits: number
  maintenanceMessage: string
}

export interface CategoryConfig {
  id: string
  name: string
  createdAt: number
}

export interface PromptLibraryItem {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

export const ALL_CATEGORY_FILTER = '__all__'
export const FAVORITES_CATEGORY_FILTER = '__favorites__'
export const UNCATEGORIZED_CATEGORY_FILTER = '__uncategorized__'
export { DEFAULT_PARAMS, UNCATEGORIZED_CATEGORY_NAME, UNKNOWN_TASK_PROVIDER_NAME }

const DEFAULT_BASE_URL = import.meta.env.VITE_DEFAULT_API_URL?.trim() || 'https://api.openai.com'
const DEFAULT_REQUEST_MODE: RequestMode = import.meta.env.DEV ? 'local_proxy' : 'direct'

export const DEFAULT_SETTINGS: AppSettings = {
  baseUrl: DEFAULT_BASE_URL,
  apiKey: '',
  model: 'gpt-image-2',
  responsesImageModel: 'gpt-image-2',
  responsesTransport: 'auto',
  responsesImageInputMode: 'auto',
  responsesPromptRevisionMode: 'allow',
  timeout: 900,
  apiProtocol: 'images',
  requestMode: DEFAULT_REQUEST_MODE,
}

// ===== 任务参数 =====

export interface TaskParams {
  size: string
  quality: 'auto' | 'low' | 'medium' | 'high'
  output_format: 'png' | 'jpeg' | 'webp'
  output_compression: number | null
  moderation: 'auto' | 'low'
  n: number
}

export interface AppliedImageParams {
  size?: string | null
  quality?: string | null
  output_format?: string | null
  background?: string | null
  action?: string | null
}

export interface AppliedTransportMeta {
  requested?: ResponsesTransportMode | null
  actual?: 'stream' | 'json' | null
  fallbackFromStream?: boolean | null
}

export interface TaskResponseMeta {
  appliedImageParams?: AppliedImageParams | null
  revisedPrompt?: string | null
  transport?: AppliedTransportMeta | null
}

export interface TaskErrorDebugImageSummary {
  index?: number
  kind: 'data_url' | 'remote_url' | 'unknown'
  mime?: string | null
  sizeBytes?: number | null
  url?: string | null
}

export interface TaskErrorDebugRequestSnapshot {
  baseUrl: string
  requestMode: RequestMode
  apiProtocol: ApiProtocol
  model: string
  responsesImageModel?: string | null
  responsesTransport?: ResponsesTransportMode | null
  responsesImageInputMode?: ResponsesImageInputMode | null
  responsesPromptRevisionMode?: ResponsesPromptRevisionMode | null
  prompt: string
  params: TaskParams
  inputImages: TaskErrorDebugImageSummary[]
  editMask?: (TaskErrorDebugImageSummary & { present: boolean }) | null
}

export interface TaskErrorDebugRequestLogEntry {
  stage: string
  method: string
  url: string
  requestHeaders?: Record<string, unknown> | null
  requestBody?: unknown
  responseStatus?: number | null
  responseRequestId?: string | null
  responseBody?: unknown
  responseText?: string | null
}

export interface TaskErrorDebugFailure {
  message: string
  status?: number | null
  requestId?: string | null
  details?: unknown
}

export interface TaskErrorDebugInfo {
  createdAt?: number
  requestId?: string | null
  status?: number | null
  requestMode?: RequestMode
  apiProtocol?: ApiProtocol
  baseUrl?: string
  model?: string
  responsesImageModel?: string | null
  responsesTransport?: ResponsesTransportMode | null
  responsesImageInputMode?: ResponsesImageInputMode | null
  responsesPromptRevisionMode?: ResponsesPromptRevisionMode | null
  request?: TaskErrorDebugRequestSnapshot | null
  requestLog?: TaskErrorDebugRequestLogEntry[] | null
  failure?: TaskErrorDebugFailure | null
  details?: unknown
}

// ===== 输入图片（UI 层面） =====

export interface InputImage {
  /** IndexedDB image store 的 id（SHA-256 hash） */
  id: string
  /** 可直接用于预览的图片地址（data URL 或公网 http(s) URL） */
  dataUrl: string
  /** 局部编辑时使用的蒙版图，仅在提交阶段参与请求 */
  maskDataUrl?: string | null
  /** 蒙版对应的选区，使用 0-1 相对坐标 */
  editSelection?: ImageEditSelection | null
  /** 追踪它来自哪条任务/哪张输出图，方便回到编辑器继续调整 */
  sourceTaskId?: string | null
  sourceImageId?: string | null
  /** 输入区内部保留的父任务链信息，后续手动提交时优先据此建立 lineage */
  lineageParentTaskId?: string | null
  lineageParentImageId?: string | null
}

// ===== 任务记录 =====

export type TaskStatus = 'running' | 'done' | 'error' | 'partial_error'
export type TaskKind = 'generation' | 'image'

export interface TaskRecord {
  id: string
  /** 任务类型：普通生成任务 / 单图任务 */
  taskKind?: TaskKind
  /** 任务提交时选中的供应商 ID */
  providerId?: string | null
  /** 任务提交时记录的供应商名称快照 */
  providerName?: string | null
  modelConfigId?: string | null
  modelName?: string | null
  modelDisplayName?: string | null
  costCredits?: number | null
  /** 任务提交时记录的分类 ID */
  categoryId?: string | null
  /** 任务提交时记录的分类名称快照 */
  categoryName?: string | null
  /** 移入回收站时间，null 表示仍在画廊 */
  deletedAt?: number | null
  /** 收藏状态，独立于分类存在 */
  isFavorite?: boolean
  /** 这条任务直接来源于哪条上游任务，例如编辑输出后新建的任务 */
  parentTaskId?: string | null
  /** 若这条任务来源于上游任务中的某张图片，则记录那张图片 id */
  parentImageId?: string | null
  prompt: string
  params: TaskParams
  /** 输入图片的 image store id 列表 */
  inputImageIds: string[]
  /** 局部编辑蒙版图片 id */
  editMaskImageId?: string | null
  /** 蒙版对应的输出图 id */
  editSourceImageId?: string | null
  /** 蒙版选区，使用 0-1 相对坐标 */
  editSelection?: ImageEditSelection | null
  /** 输出图片的 image store id 列表 */
  outputImages: string[]
  /** API 返回的实际生效图片参数与附加元信息 */
  responseMeta?: TaskResponseMeta | null
  /** 失败时记录的请求与响应调试上下文 */
  errorDebug?: TaskErrorDebugInfo | null
  /** 用户主动中止的任务会标记为 true */
  isAborted?: boolean
  status: TaskStatus
  error: string | null
  createdAt: number
  finishedAt: number | null
  /** 总耗时毫秒 */
  elapsed: number | null
}

export interface TaskImageProgress {
  completed: number
  total: number
  countLabel: string | null
}

// ===== IndexedDB 存储的图片 =====

export type StoredImageKind = 'local_blob' | 'remote_url' | 'legacy_data_url'
export type StoredImageSource = 'upload' | 'generated'

export interface StoredImageBase {
  id: string
  kind: StoredImageKind
  /** 图片首次存储时间（ms） */
  createdAt?: number
  /** 图片来源：用户上传 / API 生成 */
  source?: StoredImageSource
  /** 本地二进制内容 hash；remote URL 记录允许为空 */
  contentHash?: string | null
  mimeType?: string | null
  byteSize?: number | null
  width?: number | null
  height?: number | null
}

export interface StoredLocalBlobImage extends StoredImageBase {
  kind: 'local_blob'
  blob: Blob
  thumbnailBlob?: Blob | null
  thumbnailMimeType?: string | null
  thumbnailWidth?: number | null
  thumbnailHeight?: number | null
  migratedFromLegacyAt?: number | null
}

export interface StoredRemoteUrlImage extends StoredImageBase {
  kind: 'remote_url'
  remoteUrl: string
}

export interface StoredLegacyDataUrlImage extends StoredImageBase {
  kind: 'legacy_data_url'
  dataUrl: string
}

export type StoredImage =
  | StoredLocalBlobImage
  | StoredRemoteUrlImage
  | StoredLegacyDataUrlImage

export interface ExportImageFileEntry {
  kind?: StoredImageKind
  path?: string
  thumbnailPath?: string
  url?: string
  createdAt?: number
  source?: StoredImageSource
  mimeType?: string | null
  width?: number | null
  height?: number | null
  byteSize?: number | null
  contentHash?: string | null
}

// ===== API 请求体 =====

export interface ImageGenerationRequest {
  model: string
  prompt: string
  size: string
  quality: string
  output_format: string
  moderation: string
  output_compression?: number
  n?: number
}

// ===== API 响应 =====

export interface ImageResponseItem {
  b64_json?: string
  url?: string
}

export interface ImageApiResponse {
  data: ImageResponseItem[]
}

// ===== 导出数据 =====

/** ZIP manifest.json 格式 */
export interface ExportData {
  version: number
  exportedAt: string
  settings: AppSettings
  providers?: ProviderConfig[]
  activeProviderId?: string
  categories?: CategoryConfig[]
  activeCategoryFilter?: string
  params?: TaskParams
  promptLibrary?: PromptLibraryItem[]
  persistedState?: Record<string, unknown>
  tasks: TaskRecord[]
  /** imageId → 图片信息 */
  imageFiles: Record<string, ExportImageFileEntry>
}

export function resolveCategoryFilterName(
  filter: string,
  categories: CategoryConfig[],
): string {
  if (filter === ALL_CATEGORY_FILTER) return '全部分类'
  if (filter === FAVORITES_CATEGORY_FILTER) return '收藏'
  if (filter === UNCATEGORIZED_CATEGORY_FILTER) return UNCATEGORIZED_CATEGORY_NAME

  const category = categories.find((item) => item.id === filter)
  return category?.name?.trim() || UNCATEGORIZED_CATEGORY_NAME
}

export {
  canEditTaskOutputs,
  isTaskInRecycleBin,
  resolveTaskAppliedImageParam,
  resolveTaskCategoryName,
  resolveTaskDisplayImageParam,
  resolveTaskImageProgress,
  resolveTaskKind,
  resolveTaskProviderName,
  resolveTaskStatusLabel,
  resolveTaskTransportLabel,
  resolveTaskTransportMeta,
} from './store/taskRecords'
