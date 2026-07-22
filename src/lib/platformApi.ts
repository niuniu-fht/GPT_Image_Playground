import type {
  AdminAnnouncement,
  AdminAuditLog,
  AdminCreditLedger,
  AdminGeneratedAssetCleanupResult,
  AdminGenerationTask,
  AdminLoginLog,
  AdminPlatformSettings,
  AdminRedeemCode,
  AdminSquareCleanupResult,
  AdminSquareShare,
  AdminSquareConfig,
  AdminSquareR2TestResult,
  AdminSquareUsage,
  AdminUpstreamProvider,
  AdminUpstreamTestResult,
  AdminUsageReport,
  AdminUserDetail,
  AdminUserSummary,
  CreditOrder,
  CreditPackage,
  CurrentUser,
  ModelConfig,
  ModerationRule,
  SupportTicket,
  TaskParams,
} from '../types'

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; code?: string; message?: string }

export class PlatformApiError extends Error {
  code: string
  status: number

  constructor(message: string, input: { code?: string; status?: number } = {}) {
    super(message)
    this.name = 'PlatformApiError'
    this.code = input.code ?? 'request_failed'
    this.status = input.status ?? 0
  }
}

function resolveFallbackMessage(status: number, code?: string): string {
  if (status === 401) return '登录状态已失效，请重新登录'
  if (status === 403) return '当前账号没有权限执行这个操作'
  if (status === 404) return '请求的内容不存在或已被删除'
  if (status === 409) return '当前数据已发生变化，请刷新后重试'
  if (status === 413) return '图片或请求内容太大，请压缩后再试'
  if (status === 429) return '操作太频繁了，请稍后再试'
  if (status >= 500) return '服务暂时不可用，请稍后重试'
  if (code === 'network_error') return '网络连接异常，请检查网络后重试'
  return '请求失败，请稍后重试'
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    })
  } catch (error) {
    console.error('[api] network request failed', error)
    throw new PlatformApiError(resolveFallbackMessage(0, 'network_error'), {
      code: 'network_error',
      status: 0,
    })
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok || !payload?.ok) {
    const code = payload && !payload.ok ? payload.code : undefined
    const message = payload && !payload.ok && payload.message
      ? payload.message
      : resolveFallbackMessage(response.status, code)
    throw new PlatformApiError(message, {
      code,
      status: response.status,
    })
  }
  return payload.data
}

async function requestBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    })
  } catch (error) {
    console.error('[api] binary request failed', error)
    throw new PlatformApiError(resolveFallbackMessage(0, 'network_error'), {
      code: 'network_error',
      status: 0,
    })
  }

  if (response.ok) {
    return response.blob()
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null
  const code = payload && !payload.ok ? payload.code : undefined
  const message = payload && !payload.ok && payload.message
    ? payload.message
    : resolveFallbackMessage(response.status, code)
  throw new PlatformApiError(message, {
    code,
    status: response.status,
  })
}

export function getUserFacingErrorMessage(error: unknown, fallback = '操作失败，请稍后重试'): string {
  if (error instanceof PlatformApiError) return error.message || fallback
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export interface GenerationInputImagePayload {
  id: string
  dataUrl: string
}

export interface PlatformGenerationResult {
  taskId: string
  status?: 'running' | 'done' | 'error'
  images: Array<{ dataUrl: string; mimeType: string }>
  error?: string | null
  model: { id: string; displayName: string; costCredits: number }
  user: CurrentUser | null
  responseMeta?: unknown
}

export interface AdminUpstreamModelOption {
  id: string
  ownedBy?: string
  created?: number
}

export const platformApi = {
  getMe() {
    return request<{ user: CurrentUser | null }>('/api/auth/me')
  },

  login(input: { email: string; password: string }) {
    return request<{ user: CurrentUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  register(input: { email: string; password: string }) {
    return request<{ user: CurrentUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  changePassword(input: { currentPassword: string; newPassword: string }) {
    return request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  logout() {
    return request('/api/auth/logout', { method: 'POST' })
  },

  fetchRemoteImage(input: { url: string }) {
    return requestBlob('/api/remote-images/fetch', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  listModels() {
    return request<{ models: ModelConfig[] }>('/api/models')
  },

  listPublicAnnouncements(params: { placement?: AdminAnnouncement['placement'] } = {}) {
    const query = new URLSearchParams()
    if (params.placement) query.set('placement', params.placement)
    const suffix = query.toString() ? `?${query}` : ''
    return request<{ items: AdminAnnouncement[] }>(`/api/public/announcements${suffix}`)
  },

  getPublicLanding() {
    return request<{ landingHeroSlidesJson: string }>('/api/public/landing')
  },

  getPublicSettings() {
    return request<{ redeemDescription: string }>('/api/public/settings')
  },

  listAdminModels(params: { q?: string; status?: string; providerId?: string; health?: string; page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.status) query.set('status', params.status)
    if (params.providerId) query.set('providerId', params.providerId)
    if (params.health) query.set('health', params.health)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    return request<{ models: ModelConfig[]; total: number; page: number; pageSize: number }>(`/api/admin/models?${query}`)
  },

  createAdminModel(input: Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>) {
    return request<{ model: ModelConfig }>('/api/admin/models', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  updateAdminModel(id: string, input: Partial<Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>>) {
    return request<{ model: ModelConfig }>(`/api/admin/models/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  deleteAdminModel(id: string) {
    return request(`/api/admin/models/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  getAdminOverview() {
    return request<{
      stats: {
        users: number
        disabledUsers: number
        enabledModels: number
        enabledProviders: number
        runningTasks: number
        tasks7d: number
        failedTasks7d: number
        creditsConsumed7d: number
        creditsIncome7d: number
      }
      workbench: {
        pendingOrders: number
        openTickets: number
        failedTasks24h: number
        riskyUsers: number
        unhealthyProviders: number
        activeModerationRules: number
        recentPendingOrders: CreditOrder[]
        recentOpenTickets: SupportTicket[]
        recentUnhealthyProviders: AdminUpstreamProvider[]
      }
      trend: Array<{
        date: string
        newUsers: number
        tasks: number
        failedTasks: number
        creditsSpent: number
        creditsIncome: number
      }>
      modelUsage: Array<{
        modelConfigId: string
        displayName: string
        name: string
        enabled: boolean
        tasks: number
        credits: number
      }>
      providerSummaries: Array<{
        id: string
        name: string
        baseUrl: string
        enabled: boolean
        priority: number
        timeoutSeconds: number
        _count?: { models: number }
      }>
      recentUsers: AdminUserSummary[]
      recentTasks: AdminGenerationTask[]
    }>('/api/admin/overview')
  },

  getAdminUsageReport(params: { from?: string; to?: string } = {}) {
    const query = new URLSearchParams()
    if (params.from) query.set('from', params.from)
    if (params.to) query.set('to', params.to)
    return request<AdminUsageReport>(`/api/admin/reports/usage?${query}`)
  },

  listAdminUsers(params: { q?: string; role?: string; status?: string; segment?: string; page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.role) query.set('role', params.role)
    if (params.status) query.set('status', params.status)
    if (params.segment) query.set('segment', params.segment)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    return request<{ items: AdminUserSummary[]; total: number; page: number; pageSize: number }>(
      `/api/admin/users?${query}`,
    )
  },

  getAdminUser(id: string) {
    return request<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(id)}`)
  },

  updateAdminUser(id: string, input: Partial<Pick<AdminUserSummary, 'role' | 'status' | 'segment' | 'adminNote'>>) {
    return request<{ user: AdminUserSummary }>(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  adjustAdminUserCredits(id: string, input: { delta: number; reason: string }) {
    return request<{ user: AdminUserSummary }>(`/api/admin/users/${encodeURIComponent(id)}/credits`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  resetAdminUserPassword(id: string, input: { password: string }) {
    return request<{ user: AdminUserSummary }>(`/api/admin/users/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  updateAdminUsersStatus(input: { ids: string[]; status: AdminUserSummary['status'] }) {
    return request<{ affected: number }>('/api/admin/users/batch/status', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  adjustAdminUsersCredits(input: { ids: string[]; delta: number; reason: string }) {
    return request<{ affected: number }>('/api/admin/users/batch/credits', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  redeemCredits(input: { code: string }) {
    return request<{
      user: CurrentUser
      redeemCode: { id: string; code: string; name: string; credits: number }
    }>('/api/credits/redeem', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  listCreditPackages() {
    return request<{ items: CreditPackage[] }>('/api/credits/packages')
  },

  listCreditOrders() {
    return request<{ items: CreditOrder[] }>('/api/credits/orders')
  },

  createCreditOrder(input: { packageId: string; userNote?: string }) {
    return request<{ order: CreditOrder }>('/api/credits/orders', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  listSupportTickets() {
    return request<{ items: SupportTicket[] }>('/api/support/tickets')
  },

  createSupportTicket(input: Pick<SupportTicket, 'category' | 'priority' | 'title' | 'content' | 'contact'> & {
    relatedTaskId?: string | null
    relatedOrderNo?: string | null
  }) {
    return request<{ ticket: SupportTicket }>('/api/support/tickets', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  listAdminCreditLedger(params: { q?: string; type?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.type) query.set('type', params.type)
    if (params.from) query.set('from', params.from)
    if (params.to) query.set('to', params.to)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    return request<{ items: AdminCreditLedger[]; total: number; page: number; pageSize: number }>(
      `/api/admin/credits/ledger?${query}`,
    )
  },

  listAdminRedeemCodes(params: { q?: string; status?: string; page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.status) query.set('status', params.status)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    return request<{ items: AdminRedeemCode[]; total: number; page: number; pageSize: number }>(
      `/api/admin/redeem-codes?${query}`,
    )
  },

  createAdminRedeemCode(input: Omit<AdminRedeemCode, 'id' | 'createdAt' | 'updatedAt' | 'usedCount' | '_count' | 'redemptions'>) {
    return request<{ redeemCode: AdminRedeemCode }>('/api/admin/redeem-codes', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  createAdminRedeemCodesBatch(input: Omit<AdminRedeemCode, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'usedCount' | '_count' | 'redemptions'> & {
    prefix: string
    count: number
    codeLength: number
  }) {
    return request<{ redeemCodes: AdminRedeemCode[]; codes: string[] }>('/api/admin/redeem-codes/batch', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  importAdminRedeemCodes(input: Omit<AdminRedeemCode, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'usedCount' | '_count' | 'redemptions'> & {
    codes: string[]
  }) {
    return request<{ redeemCodes: AdminRedeemCode[]; codes: string[] }>('/api/admin/redeem-codes/import', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  updateAdminRedeemCode(id: string, input: Partial<Omit<AdminRedeemCode, 'id' | 'createdAt' | 'updatedAt' | 'usedCount' | '_count' | 'redemptions'>>) {
    return request<{ redeemCode: AdminRedeemCode }>(`/api/admin/redeem-codes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  deleteAdminRedeemCode(id: string) {
    return request(`/api/admin/redeem-codes/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  listAdminCreditPackages() {
    return request<{ items: CreditPackage[] }>('/api/admin/credit-packages')
  },

  createAdminCreditPackage(input: Omit<CreditPackage, 'id' | 'createdAt' | 'updatedAt' | '_count'>) {
    return request<{ creditPackage: CreditPackage }>('/api/admin/credit-packages', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  updateAdminCreditPackage(id: string, input: Partial<Omit<CreditPackage, 'id' | 'createdAt' | 'updatedAt' | '_count'>>) {
    return request<{ creditPackage: CreditPackage }>(`/api/admin/credit-packages/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  deleteAdminCreditPackage(id: string) {
    return request(`/api/admin/credit-packages/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  listAdminCreditOrders(params: { q?: string; status?: string; page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.status) query.set('status', params.status)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    return request<{ items: CreditOrder[]; total: number; page: number; pageSize: number }>(
      `/api/admin/credit-orders?${query}`,
    )
  },

  updateAdminCreditOrder(id: string, input: { status: 'paid' | 'cancelled'; adminNote?: string }) {
    return request<{ order: CreditOrder }>(`/api/admin/credit-orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  listAdminSupportTickets(params: { q?: string; status?: string; priority?: string; page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.status) query.set('status', params.status)
    if (params.priority) query.set('priority', params.priority)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    return request<{ items: SupportTicket[]; total: number; page: number; pageSize: number }>(
      `/api/admin/support-tickets?${query}`,
    )
  },

  updateAdminSupportTicket(id: string, input: Partial<Pick<SupportTicket, 'status' | 'priority' | 'adminReply' | 'adminNote'>>) {
    return request<{ ticket: SupportTicket }>(`/api/admin/support-tickets/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  listAdminModerationRules(params: { q?: string; enabled?: string; page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.enabled) query.set('enabled', params.enabled)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    return request<{ items: ModerationRule[]; total: number; page: number; pageSize: number }>(`/api/admin/moderation-rules?${query}`)
  },

  createAdminModerationRule(input: Omit<ModerationRule, 'id' | 'createdAt' | 'updatedAt' | 'hitCount' | 'lastHitAt'>) {
    return request<{ rule: ModerationRule }>('/api/admin/moderation-rules', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  updateAdminModerationRule(id: string, input: Partial<Omit<ModerationRule, 'id' | 'createdAt' | 'updatedAt' | 'hitCount' | 'lastHitAt'>>) {
    return request<{ rule: ModerationRule }>(`/api/admin/moderation-rules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  deleteAdminModerationRule(id: string) {
    return request(`/api/admin/moderation-rules/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  listAdminTasks(params: { status?: string; q?: string; modelConfigId?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.q) query.set('q', params.q)
    if (params.modelConfigId) query.set('modelConfigId', params.modelConfigId)
    if (params.from) query.set('from', params.from)
    if (params.to) query.set('to', params.to)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    return request<{ items: AdminGenerationTask[]; total: number; page: number; pageSize: number }>(
      `/api/admin/tasks?${query}`,
    )
  },

  deleteAdminTask(id: string) {
    return request<{ deleted: boolean; cleanup: AdminGeneratedAssetCleanupResult }>(
      `/api/admin/tasks/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    )
  },

  getAdminTask(id: string) {
    return request<{ task: AdminGenerationTask }>(`/api/admin/tasks/${encodeURIComponent(id)}`)
  },

  deleteAdminTasks(ids: string[]) {
    return request<{ affected: number; cleanup: AdminGeneratedAssetCleanupResult }>('/api/admin/tasks/batch/delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },

  listAdminAuditLogs(params: { q?: string; action?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.action) query.set('action', params.action)
    if (params.from) query.set('from', params.from)
    if (params.to) query.set('to', params.to)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    return request<{ items: AdminAuditLog[]; total: number; page: number; pageSize: number }>(`/api/admin/audit-logs?${query}`)
  },

  listAdminLoginLogs(params: { q?: string; success?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.success) query.set('success', params.success)
    if (params.from) query.set('from', params.from)
    if (params.to) query.set('to', params.to)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    return request<{ items: AdminLoginLog[]; total: number; page: number; pageSize: number }>(`/api/admin/login-logs?${query}`)
  },

  getAdminSettings() {
    return request<{ settings: AdminPlatformSettings }>('/api/admin/settings')
  },

  updateAdminSettings(input: Partial<AdminPlatformSettings>) {
    return request<{ settings: AdminPlatformSettings }>('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  testAdminSub2ApiRedeem(input: { code: string }) {
    return request<{ ok: boolean; message: string }>('/api/admin/settings/sub2api-redeem/test', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  listAdminUpstreams(params: { q?: string; status?: string; health?: string; page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.status) query.set('status', params.status)
    if (params.health) query.set('health', params.health)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    return request<{ items: AdminUpstreamProvider[]; total: number; page: number; pageSize: number }>(`/api/admin/upstreams?${query}`)
  },

  createAdminUpstream(input: Omit<AdminUpstreamProvider, 'id' | 'createdAt' | 'updatedAt' | '_count' | 'models' | 'lastCheckedAt' | 'lastHealthStatus' | 'lastLatencyMs' | 'lastHttpStatus' | 'lastHealthMessage'>) {
    return request<{ provider: AdminUpstreamProvider }>('/api/admin/upstreams', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  updateAdminUpstream(id: string, input: Partial<Omit<AdminUpstreamProvider, 'id' | 'createdAt' | 'updatedAt' | '_count' | 'models' | 'lastCheckedAt' | 'lastHealthStatus' | 'lastLatencyMs' | 'lastHttpStatus' | 'lastHealthMessage'>>) {
    return request<{ provider: AdminUpstreamProvider }>(`/api/admin/upstreams/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  deleteAdminUpstream(id: string) {
    return request(`/api/admin/upstreams/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  testAdminUpstream(id: string) {
    return request<{ result: AdminUpstreamTestResult }>(`/api/admin/upstreams/${encodeURIComponent(id)}/test`, {
      method: 'POST',
    })
  },

  listAdminUpstreamModels(id: string) {
    return request<{ models: AdminUpstreamModelOption[]; checkedAt: string; latencyMs: number }>(
      `/api/admin/upstreams/${encodeURIComponent(id)}/models`,
    )
  },

  testAdminUpstreams(ids?: string[]) {
    return request<{
      results: Array<AdminUpstreamTestResult & { providerId: string; providerName: string }>
    }>('/api/admin/upstreams/batch/test', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },

  listAdminAnnouncements(params: { q?: string; status?: string; placement?: string; level?: string; page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.status) query.set('status', params.status)
    if (params.placement) query.set('placement', params.placement)
    if (params.level) query.set('level', params.level)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    return request<{ items: AdminAnnouncement[]; total: number; page: number; pageSize: number }>(`/api/admin/announcements?${query}`)
  },

  createAdminAnnouncement(input: Omit<AdminAnnouncement, 'id' | 'createdAt' | 'updatedAt'>) {
    return request<{ announcement: AdminAnnouncement }>('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  updateAdminAnnouncement(id: string, input: Partial<Omit<AdminAnnouncement, 'id' | 'createdAt' | 'updatedAt'>>) {
    return request<{ announcement: AdminAnnouncement }>(`/api/admin/announcements/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  deleteAdminAnnouncement(id: string) {
    return request(`/api/admin/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  getAdminSquareUsage() {
    return request<AdminSquareUsage>('/api/admin/square/usage')
  },

  listAdminSquareShares(params: { status?: string; kind?: string; q?: string; page?: number; pageSize?: number; limit?: number } = {}) {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.kind) query.set('kind', params.kind)
    if (params.q) query.set('q', params.q)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    if (params.limit) query.set('limit', String(params.limit))
    return request<{ items: AdminSquareShare[]; total: number; page: number; pageSize: number }>(`/api/admin/square/shares?${query}`)
  },

  updateAdminSquareShareStatus(id: string, status: AdminSquareShare['status']) {
    return request(`/api/admin/square/shares/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    })
  },

  updateAdminSquareSharesStatus(ids: string[], status: AdminSquareShare['status']) {
    return request<{ affected: number; requested: number; status: AdminSquareShare['status'] }>('/api/admin/square/shares/batch/status', {
      method: 'POST',
      body: JSON.stringify({ ids, status }),
    })
  },

  cleanupAdminSquare(input: { dryRun?: boolean; limit?: number; prunePublished?: boolean } = {}) {
    return request<AdminSquareCleanupResult>('/api/admin/square/cleanup', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  getAdminSquareConfig() {
    return request<{ config: AdminSquareConfig }>('/api/admin/square/config')
  },

  testAdminSquareR2() {
    return request<{ result: AdminSquareR2TestResult }>('/api/admin/square/test-r2', {
      method: 'POST',
    })
  },

  updateAdminSquareConfig(input: Partial<AdminSquareConfig> & {
    squareAdminToken?: string
    r2SecretKey?: string
  }) {
    return request<{ config: AdminSquareConfig }>('/api/admin/square/config', {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  generate(input: {
    clientRequestId: string
    modelConfigId: string
    prompt: string
    params: TaskParams
    inputImages: GenerationInputImagePayload[]
    editMask?: {
      dataUrl: string
      sourceImageId?: string | null
      selection?: unknown
    } | null
  }, signal?: AbortSignal) {
    return request<PlatformGenerationResult>('/api/generations', {
      method: 'POST',
      body: JSON.stringify(input),
      signal,
    })
  },

  getGenerationTask(taskId: string, signal?: AbortSignal) {
    return request<PlatformGenerationResult>(`/api/generations/${encodeURIComponent(taskId)}`, {
      signal,
    })
  },
}
