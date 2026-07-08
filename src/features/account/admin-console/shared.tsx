import type React from 'react'
import type {
  AdminAnnouncement,
  AdminGenerationTask,
  AdminLoginLog,
  AdminPlatformSettings,
  AdminRedeemCode,
  AdminUpstreamProvider,
  AdminUpstreamTestResult,
  AdminUserSummary,
  CreditPackage,
  ModelConfig,
  ModerationRule,
  SupportTicket,
} from '../../../types'

export type AdminTab = 'overview' | 'reports' | 'users' | 'loginLogs' | 'credits' | 'redeemCodes' | 'billing' | 'tickets' | 'moderation' | 'tasks' | 'models' | 'upstreams' | 'square' | 'announcements' | 'settings' | 'audit'
export type AdminEditor = 'model' | 'upstream' | 'announcement' | 'redeemCode' | 'creditPackage' | 'moderationRule' | null

export type ModelDraft = Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt' | 'upstreamProvider'>
export type UpstreamDraft = Omit<AdminUpstreamProvider, 'id' | 'createdAt' | 'updatedAt' | '_count' | 'models' | 'lastCheckedAt' | 'lastHealthStatus' | 'lastLatencyMs' | 'lastHttpStatus' | 'lastHealthMessage'>
export type AnnouncementDraft = Omit<AdminAnnouncement, 'id' | 'createdAt' | 'updatedAt'>
export type RedeemCodeDraft = Omit<AdminRedeemCode, 'id' | 'createdAt' | 'updatedAt' | 'usedCount' | '_count' | 'redemptions'>
export type CreditPackageDraft = Omit<CreditPackage, 'id' | 'createdAt' | 'updatedAt' | '_count'>
export type ModerationRuleDraft = Omit<ModerationRule, 'id' | 'createdAt' | 'updatedAt' | 'hitCount' | 'lastHitAt'>

export type AdminNavItem = { id: AdminTab; label: string; caption: string }

export const navGroups: Array<{ id: string; label: string; caption: string; items: AdminNavItem[] }> = [
  {
    id: 'insight',
    label: '经营看板',
    caption: '指标、趋势、待办',
    items: [
      { id: 'overview', label: '运营总览', caption: '用户、任务、消耗' },
      { id: 'reports', label: '数据报表', caption: '用量、成功率、排行' },
    ],
  },
  {
    id: 'users',
    label: '用户运营',
    caption: '账号、积分、客服',
    items: [
      { id: 'users', label: '用户与积分', caption: '账号、余额、权限' },
      { id: 'loginLogs', label: '登录日志', caption: '账号安全、失败排查' },
      { id: 'credits', label: '积分流水', caption: '收入、消耗、退回' },
      { id: 'billing', label: '套餐订单', caption: '充值、确认、套餐' },
      { id: 'redeemCodes', label: '兑换码', caption: '活动发放、补贴' },
      { id: 'tickets', label: '反馈工单', caption: '客服、问题、投诉' },
    ],
  },
  {
    id: 'content',
    label: '内容运营',
    caption: '广场、公告、风控',
    items: [
      { id: 'square', label: '广场内容', caption: '分享、审核、清理' },
      { id: 'announcements', label: '公告', caption: '前台运营消息' },
      { id: 'moderation', label: '风控规则', caption: '提示词、敏感词' },
    ],
  },
  {
    id: 'system',
    label: '模型与系统',
    caption: '模型、上游、日志',
    items: [
      { id: 'models', label: '模型配置', caption: '展示、价格、绑定' },
      { id: 'upstreams', label: '上游渠道', caption: '转发地址、密钥' },
      { id: 'tasks', label: '生成日志', caption: '请求、失败、消耗' },
      { id: 'settings', label: '平台设置', caption: '注册、生成、维护' },
      { id: 'audit', label: '审计日志', caption: '管理员操作记录' },
    ],
  },
]

export const navItems: AdminNavItem[] = navGroups.flatMap((group) => group.items)

export const emptyModelDraft: ModelDraft = {
  name: '',
  displayName: '',
  description: '',
  icon: 'sparkles',
  costCredits: 1,
  costCredits2K: 2,
  costCredits4K: 4,
  lowQualityCostCredits: 1,
  lowQualityCostCredits2K: 2,
  lowQualityCostCredits4K: 4,
  highQualityEnabled: true,
  highQualityCostCredits: 2,
  highQualityCostCredits2K: 4,
  highQualityCostCredits4K: 8,
  upstreamModel: 'gpt-image-2',
  upstreamProviderId: null,
  apiProtocol: 'images',
  enabled: true,
  isNew: false,
  sortOrder: 100,
}

export const emptyUpstreamDraft: UpstreamDraft = {
  name: '',
  baseUrl: 'https://api.openai.com',
  apiKey: '',
  enabled: true,
  priority: 100,
  timeoutSeconds: 900,
  notes: '',
}

export const emptyAnnouncementDraft: AnnouncementDraft = {
  title: '',
  content: '',
  level: 'info',
  placement: 'global',
  actionLabel: '',
  actionUrl: '',
  status: 'draft',
  pinned: false,
  startsAt: null,
  endsAt: null,
}

export const emptyRedeemCodeDraft: RedeemCodeDraft = {
  code: '',
  name: '',
  credits: 100,
  maxRedemptions: 1,
  perUserLimit: 1,
  status: 'active',
  startsAt: null,
  endsAt: null,
  note: '',
}

export const emptyCreditPackageDraft: CreditPackageDraft = {
  name: '',
  description: '',
  credits: 100,
  bonusCredits: 0,
  priceCents: 990,
  currency: 'CNY',
  badge: '',
  enabled: true,
  sortOrder: 100,
}

export const emptyModerationRuleDraft: ModerationRuleDraft = {
  name: '',
  type: 'keyword',
  pattern: '',
  action: 'block',
  message: '提示词包含平台暂不支持的内容，请调整后重试',
  enabled: true,
  priority: 100,
  note: '',
}

export const defaultSettingsDraft: AdminPlatformSettings = {
  registerEnabled: true,
  generationEnabled: true,
  registerBonusCredits: 100,
  maintenanceMessage: '',
  redeemDescription: '活动码和客服补偿码会立即到账，并写入积分流水。',
  landingHeroSlidesJson: '',
}

export const adminPageSize = 20

export function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(' ')
}

export function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}

export function formatDateTimeInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function formatJson(value: unknown) {
  if (value === null || value === undefined) return '-'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function taskParamsSummary(value: unknown) {
  if (!value || typeof value !== 'object') return '-'
  const params = value as Record<string, unknown>
  const qualityLabel = params.quality === 'low'
    ? '低'
    : params.quality === 'medium'
      ? '中'
      : params.quality === 'high'
        ? '高'
        : params.quality
  const parts = [
    typeof params.size === 'string' ? params.size : '',
    typeof qualityLabel === 'string' ? `质量 ${qualityLabel}` : '',
    typeof params.output_format === 'string' ? params.output_format.toUpperCase() : '',
    typeof params.n === 'number' ? `${params.n} 张` : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '-'
}

export function StatCard({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className="text-xs font-medium text-gray-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">{value}</div>
      <div className="mt-2 text-xs text-gray-500">{hint}</div>
    </div>
  )
}

export function SectionShell({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="mb-5 flex flex-shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 admin-scrollbar">
        {children}
      </div>
    </section>
  )
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500 dark:border-white/[0.08] dark:bg-white/[0.03]">
      {text}
    </div>
  )
}

export function StatusBadge({ tone, children }: { tone: 'green' | 'blue' | 'purple' | 'amber' | 'red' | 'gray'; children: React.ReactNode }) {
  const styles = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
    blue: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20',
    purple: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20',
    red: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20',
    gray: 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:ring-white/[0.08]',
  }
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1', styles[tone])}>{children}</span>
}

export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1)
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 bg-white px-4 py-3 text-xs text-gray-500 dark:border-white/[0.06] dark:bg-transparent sm:flex-row sm:items-center sm:justify-between">
      <div>
        共 <span className="font-semibold text-gray-900 dark:text-gray-100">{total}</span> 条
        {total > 0 && <span>，当前 {start}-{end}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="h-8 rounded-lg border border-gray-200 px-3 font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:text-gray-200 dark:hover:bg-white/[0.06]"
        >
          上一页
        </button>
        <span className="min-w-16 text-center font-medium text-gray-700 dark:text-gray-200">{page} / {totalPages}</span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="h-8 rounded-lg border border-gray-200 px-3 font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:text-gray-200 dark:hover:bg-white/[0.06]"
        >
          下一页
        </button>
      </div>
    </div>
  )
}

export function AdminTableShell({
  children,
  footer,
  mobileHint = '横向滑动查看更多字段和操作',
  className,
  bodyClassName,
}: {
  children: React.ReactNode
  footer?: React.ReactNode
  mobileHint?: string
  className?: string
  bodyClassName?: string
}) {
  return (
    <div className={cx(
      'flex min-h-[280px] max-h-[calc(100vh-320px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]',
      className,
    )}>
      {mobileHint && (
        <div className="flex-shrink-0 border-b border-gray-100 bg-white px-4 py-2 text-xs text-gray-400 dark:border-white/[0.06] dark:bg-transparent md:hidden">
          {mobileHint}
        </div>
      )}
      <div className={cx('min-h-0 flex-1 overflow-auto overscroll-contain admin-scrollbar', bodyClassName)}>
        {children}
      </div>
      {footer && <div className="flex-shrink-0">{footer}</div>}
    </div>
  )
}

export function ProgressRow({
  label,
  value,
  max,
  meta,
  tone = 'blue',
}: {
  label: string
  value: number
  max: number
  meta: string
  tone?: 'blue' | 'amber' | 'green' | 'red'
}) {
  const colors = {
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    green: 'bg-emerald-500',
    red: 'bg-rose-500',
  }
  const width = max > 0 ? Math.max(Math.round((value / max) * 100), value > 0 ? 6 : 0) : 0
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium text-gray-800 dark:text-gray-100">{label}</span>
        <span className="shrink-0 text-xs text-gray-400">{meta}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
        <div className={cx('h-full rounded-full', colors[tone])} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

export function TrendGrid({
  items,
}: {
  items: Array<{ date: string; newUsers: number; tasks: number; failedTasks: number; creditsSpent: number; creditsIncome: number }>
}) {
  const maxTasks = Math.max(...items.map((item) => item.tasks), 1)
  const maxCredits = Math.max(...items.map((item) => item.creditsSpent + item.creditsIncome), 1)
  return (
    <div className="grid gap-2 sm:grid-cols-7">
      {items.map((item) => {
        const taskHeight = Math.max(Math.round((item.tasks / maxTasks) * 58), item.tasks > 0 ? 8 : 2)
        const creditHeight = Math.max(Math.round(((item.creditsSpent + item.creditsIncome) / maxCredits) * 58), item.creditsSpent + item.creditsIncome > 0 ? 8 : 2)
        return (
          <div key={item.date} className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-white/[0.06] dark:bg-white/[0.04]">
            <div className="mb-3 text-xs font-medium text-gray-400">{item.date.slice(5)}</div>
            <div className="flex h-16 items-end gap-1.5">
              <div className="w-3 rounded-t bg-blue-500" style={{ height: taskHeight }} title={`任务 ${item.tasks}`} />
              <div className="w-3 rounded-t bg-amber-500" style={{ height: creditHeight }} title={`积分流转 ${item.creditsSpent + item.creditsIncome}`} />
            </div>
            <div className="mt-3 space-y-1 text-[11px] text-gray-500">
              <div className="flex justify-between"><span>任务</span><span>{item.tasks}</span></div>
              <div className="flex justify-between"><span>用户</span><span>{item.newUsers}</span></div>
              <div className="flex justify-between"><span>失败</span><span>{item.failedTasks}</span></div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function taskTone(status: AdminGenerationTask['status']) {
  if (status === 'done') return 'green'
  if (status === 'error') return 'red'
  return 'blue'
}

export function announcementTone(level: AdminAnnouncement['level']) {
  if (level === 'success') return 'green'
  if (level === 'warning') return 'amber'
  if (level === 'critical') return 'red'
  return 'blue'
}

export function announcementLevelLabel(level: AdminAnnouncement['level']) {
  if (level === 'success') return '活动'
  if (level === 'warning') return '提醒'
  if (level === 'critical') return '重要'
  return '通知'
}

export function announcementPlacementLabel(placement: AdminAnnouncement['placement']) {
  if (placement === 'home') return '首页'
  if (placement === 'workspace') return '工作台'
  if (placement === 'square') return '广场'
  return '全站'
}

export function announcementStatusLabel(status: AdminAnnouncement['status']) {
  if (status === 'published') return '已发布'
  if (status === 'archived') return '已归档'
  return '草稿'
}

export function userSegmentTone(segment: AdminUserSummary['segment']) {
  if (segment === 'vip') return 'blue'
  if (segment === 'trial') return 'amber'
  if (segment === 'risk') return 'red'
  return 'gray'
}

export function userSegmentLabel(segment: AdminUserSummary['segment']) {
  if (segment === 'vip') return 'VIP'
  if (segment === 'trial') return '试用'
  if (segment === 'risk') return '风险'
  return '普通'
}

export function loginReasonLabel(reason: AdminLoginLog['reason']) {
  if (reason === 'login_success') return '登录成功'
  if (reason === 'register_success') return '注册成功'
  if (reason === 'unknown_email') return '邮箱不存在'
  if (reason === 'wrong_password') return '密码错误'
  if (reason === 'account_disabled') return '账号禁用'
  return reason || '-'
}

export function loginReasonTone(log: Pick<AdminLoginLog, 'success' | 'reason'>): 'green' | 'amber' | 'red' {
  if (log.success) return 'green'
  if (log.reason === 'account_disabled') return 'amber'
  return 'red'
}

export function upstreamHealthTone(status?: AdminUpstreamProvider['lastHealthStatus']) {
  if (status === 'healthy') return 'green'
  if (status === 'error') return 'red'
  return 'gray'
}

export function upstreamHealthLabel(status?: AdminUpstreamProvider['lastHealthStatus']) {
  if (status === 'healthy') return '可用'
  if (status === 'error') return '异常'
  return '未测试'
}

export function ticketStatusLabel(status: SupportTicket['status']) {
  if (status === 'in_progress') return '处理中'
  if (status === 'resolved') return '已解决'
  if (status === 'closed') return '已关闭'
  return '待处理'
}

export function ticketPriorityLabel(priority: SupportTicket['priority']) {
  if (priority === 'urgent') return '紧急'
  if (priority === 'high') return '高'
  if (priority === 'low') return '低'
  return '普通'
}

export function ticketCategoryLabel(category: SupportTicket['category']) {
  if (category === 'generation') return '生成问题'
  if (category === 'billing') return '订单积分'
  if (category === 'square') return '广场内容'
  if (category === 'account') return '账号权限'
  return '通用反馈'
}

export function upstreamHealthSnapshot(provider: AdminUpstreamProvider, live?: AdminUpstreamTestResult) {
  return {
    status: live ? (live.ok ? 'healthy' : 'error') as AdminUpstreamProvider['lastHealthStatus'] : provider.lastHealthStatus,
    checkedAt: live?.checkedAt ?? provider.lastCheckedAt,
    latencyMs: live?.latencyMs ?? provider.lastLatencyMs,
    httpStatus: live?.status ?? provider.lastHttpStatus,
    message: live?.message ?? provider.lastHealthMessage,
    modelCount: live?.modelCount,
  }
}
