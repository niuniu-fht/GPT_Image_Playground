import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { platformApi } from '../../lib/platformApi'
import { useStore } from '../../store'
import { AdminQuickSwitch } from './admin-console/AdminQuickSwitch'
import { AuditDialog, AuditSection } from './admin-console/AuditSection'
import { BillingSection } from './admin-console/BillingSection'
import { LoginLogDialog, LoginLogsSection } from './admin-console/LoginLogsSection'
import { ModelConfigDrawer } from './admin-console/model-config/ModelConfigDrawer'
import { ModelsSection } from './admin-console/ModelsSection'
import { ModerationSection } from './admin-console/ModerationSection'
import { RedeemCodesSection } from './admin-console/RedeemCodesSection'
import { SquareDialog, SquareSection } from './admin-console/SquareSection'
import { TicketsSection } from './admin-console/TicketsSection'
import { UpstreamConfigDrawer } from './admin-console/upstream-config/UpstreamConfigDrawer'
import { UsersSection } from './admin-console/UsersSection'
import {
  adminPageSize,
  AdminTableShell,
  announcementLevelLabel,
  announcementPlacementLabel,
  announcementStatusLabel,
  announcementTone,
  cx,
  defaultSettingsDraft,
  downloadCsv,
  EmptyState,
  emptyAnnouncementDraft,
  emptyCreditPackageDraft,
  emptyModerationRuleDraft,
  emptyModelDraft,
  emptyRedeemCodeDraft,
  emptyUpstreamDraft,
  formatDateTimeInput,
  formatJson,
  formatTime,
  loginReasonLabel,
  loginReasonTone,
  navGroups,
  navItems,
  PaginationBar,
  ProgressRow,
  SectionShell,
  StatCard,
  StatusBadge,
  ticketCategoryLabel,
  ticketPriorityLabel,
  ticketStatusLabel,
  taskParamsSummary,
  taskTone,
  TrendGrid,
  upstreamHealthLabel,
  upstreamHealthSnapshot,
  upstreamHealthTone,
  userSegmentLabel,
  userSegmentTone,
  type AdminEditor,
  type AdminTab,
  type AnnouncementDraft,
  type CreditPackageDraft,
  type ModerationRuleDraft,
  type ModelDraft,
  type RedeemCodeDraft,
  type UpstreamDraft,
} from './admin-console/shared'
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
  AdminSquareConfig,
  AdminSquareR2TestResult,
  AdminSquareShare,
  AdminSquareUsage,
  AdminUpstreamProvider,
  AdminUpstreamTestResult,
  AdminUsageReport,
  AdminUserDetail,
  AdminUserSummary,
  CreditOrder,
  CreditPackage,
  ModelConfig,
  ModerationRule,
  SupportTicket,
} from '../../types'

const navGroupVisuals: Record<string, { mark: string; shell: string; activeShell: string; itemIdle: string; itemActive: string; itemCaption: string; icon: string; dot: string; accent: string }> = {
  insight: {
    mark: '◎',
    shell: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20',
    activeShell: 'bg-blue-100 text-blue-800 ring-blue-200 dark:bg-blue-400/15 dark:text-blue-200 dark:ring-blue-400/25',
    itemIdle: 'text-blue-700/85 hover:bg-blue-50 hover:text-blue-800 dark:text-blue-200/75 dark:hover:bg-blue-400/10 dark:hover:text-blue-100',
    itemActive: 'bg-blue-50 text-blue-800 ring-1 ring-blue-200 shadow-sm dark:bg-blue-400/12 dark:text-blue-200 dark:ring-blue-400/25',
    itemCaption: 'text-blue-500/70 dark:text-blue-300/55',
    icon: 'bg-blue-600 text-white shadow-blue-500/20',
    dot: 'bg-blue-500',
    accent: 'text-blue-500',
  },
  users: {
    mark: '◧',
    shell: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
    activeShell: 'bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/25',
    itemIdle: 'text-emerald-700/85 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-200/75 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-100',
    itemActive: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 shadow-sm dark:bg-emerald-400/12 dark:text-emerald-200 dark:ring-emerald-400/25',
    itemCaption: 'text-emerald-500/70 dark:text-emerald-300/55',
    icon: 'bg-emerald-600 text-white shadow-emerald-500/20',
    dot: 'bg-emerald-500',
    accent: 'text-emerald-500',
  },
  content: {
    mark: '◇',
    shell: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20',
    activeShell: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/25',
    itemIdle: 'text-amber-700/90 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-200/75 dark:hover:bg-amber-400/10 dark:hover:text-amber-100',
    itemActive: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200 shadow-sm dark:bg-amber-400/12 dark:text-amber-200 dark:ring-amber-400/25',
    itemCaption: 'text-amber-500/75 dark:text-amber-300/55',
    icon: 'bg-amber-500 text-white shadow-amber-500/20',
    dot: 'bg-amber-500',
    accent: 'text-amber-500',
  },
  system: {
    mark: '✦',
    shell: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20',
    activeShell: 'bg-violet-100 text-violet-800 ring-violet-200 dark:bg-violet-400/15 dark:text-violet-200 dark:ring-violet-400/25',
    itemIdle: 'text-violet-700/85 hover:bg-violet-50 hover:text-violet-800 dark:text-violet-200/75 dark:hover:bg-violet-400/10 dark:hover:text-violet-100',
    itemActive: 'bg-violet-50 text-violet-800 ring-1 ring-violet-200 shadow-sm dark:bg-violet-400/12 dark:text-violet-200 dark:ring-violet-400/25',
    itemCaption: 'text-violet-500/70 dark:text-violet-300/55',
    icon: 'bg-violet-600 text-white shadow-violet-500/20',
    dot: 'bg-violet-500',
    accent: 'text-violet-500',
  },
}

function formatAssetSize(byteSize?: number | null): string {
  if (!byteSize || byteSize <= 0) return '-'
  if (byteSize < 1024) return `${byteSize} B`
  if (byteSize < 1024 * 1024) return `${(byteSize / 1024).toFixed(1)} KB`
  return `${(byteSize / 1024 / 1024).toFixed(2)} MB`
}

function formatAssetDimensions(width?: number | null, height?: number | null): string {
  return width && height ? `${width} x ${height}` : '-'
}

function getAssetHost(publicUrl: string): string {
  try {
    return new URL(publicUrl).host
  } catch {
    return publicUrl
  }
}

function formatTaskCleanupSummary(cleanup: AdminGeneratedAssetCleanupResult): string {
  const parts = [`云端对象 ${cleanup.r2Objects} 个`]
  if (cleanup.skippedAssets > 0) {
    parts.push(`${cleanup.skippedAssets} 个外置资产未处理`)
  }
  return parts.join('，')
}

function formatSquareCleanupPreview(result: AdminSquareCleanupResult): string {
  const candidates = result.candidates
  if (!candidates) return '已完成一次广场清理预检'
  return `可清理 ${candidates.shares} 条已删除分享，${candidates.r2Objects} 个 R2 对象`
}

function formatSquareCleanupResult(result: AdminSquareCleanupResult): string {
  const deleted = result.deleted
  if (!deleted) return '广场清理已完成'
  return `已清理 ${deleted.shares} 条分享，${deleted.r2Objects} 个 R2 对象`
}

export default function AdminConsole() {
  const open = useStore((state) => state.showAdminModels)
  const setOpen = useStore((state) => state.setShowAdminModels)
  const setModels = useStore((state) => state.setModels)
  const showToast = useStore((state) => state.showToast)
  const setConfirmDialog = useStore((state) => state.setConfirmDialog)
  const currentUser = useStore((state) => state.currentUser)
  const authReady = useStore((state) => state.authReady)
  const openAuthModal = useStore((state) => state.openAuthModal)
  const [tab, setTab] = useState<AdminTab>('overview')
  const [expandedNavGroupIds, setExpandedNavGroupIds] = useState<string[]>(() => [navGroups[0]?.id ?? 'insight'])
  const [loading, setLoading] = useState(false)
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof platformApi.getAdminOverview>> | null>(null)
  const [overviewSquareUsage, setOverviewSquareUsage] = useState<AdminSquareUsage | null>(null)
  const [overviewSquarePendingShares, setOverviewSquarePendingShares] = useState<AdminSquareShare[]>([])
  const [usageReport, setUsageReport] = useState<AdminUsageReport | null>(null)
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const [loginLogs, setLoginLogs] = useState<AdminLoginLog[]>([])
  const [loginLogPage, setLoginLogPage] = useState(1)
  const [loginLogTotal, setLoginLogTotal] = useState(0)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [batchCreditDelta, setBatchCreditDelta] = useState('100')
  const [batchCreditReason, setBatchCreditReason] = useState('活动补发')
  const [batchOperating, setBatchOperating] = useState(false)
  const [creditLedgers, setCreditLedgers] = useState<AdminCreditLedger[]>([])
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerTotal, setLedgerTotal] = useState(0)
  const [redeemCodes, setRedeemCodes] = useState<AdminRedeemCode[]>([])
  const [redeemCodePage, setRedeemCodePage] = useState(1)
  const [redeemCodeTotal, setRedeemCodeTotal] = useState(0)
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([])
  const [creditOrders, setCreditOrders] = useState<CreditOrder[]>([])
  const [orderPage, setOrderPage] = useState(1)
  const [orderTotal, setOrderTotal] = useState(0)
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([])
  const [ticketPage, setTicketPage] = useState(1)
  const [ticketTotal, setTicketTotal] = useState(0)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [moderationRules, setModerationRules] = useState<ModerationRule[]>([])
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetail | null>(null)
  const [userDetailLoading, setUserDetailLoading] = useState(false)
  const [userDialogMode, setUserDialogMode] = useState<'detail' | 'credit' | 'password' | null>(null)
  const [tasks, setTasks] = useState<AdminGenerationTask[]>([])
  const [tasksPage, setTasksPage] = useState(1)
  const [tasksTotal, setTasksTotal] = useState(0)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [taskBatchOperating, setTaskBatchOperating] = useState(false)
  const [models, setLocalModels] = useState<ModelConfig[]>([])
  const [modelLoadError, setModelLoadError] = useState('')
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([])
  const [modelBatchOperating, setModelBatchOperating] = useState(false)
  const [upstreams, setUpstreams] = useState<AdminUpstreamProvider[]>([])
  const [upstreamTests, setUpstreamTests] = useState<Record<string, AdminUpstreamTestResult>>({})
  const [testingUpstreamId, setTestingUpstreamId] = useState<string | null>(null)
  const [selectedUpstreamIds, setSelectedUpstreamIds] = useState<string[]>([])
  const [upstreamBatchTesting, setUpstreamBatchTesting] = useState(false)
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([])
  const [selectedAnnouncementIds, setSelectedAnnouncementIds] = useState<string[]>([])
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null)
  const [announcementBatchOperating, setAnnouncementBatchOperating] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<AdminPlatformSettings>(defaultSettingsDraft)
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([])
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditQuery, setAuditQuery] = useState('')
  const [auditAction, setAuditAction] = useState('all')
  const [auditFrom, setAuditFrom] = useState('')
  const [auditTo, setAuditTo] = useState('')
  const [loginLogQuery, setLoginLogQuery] = useState('')
  const [loginLogSuccess, setLoginLogSuccess] = useState('all')
  const [loginLogFrom, setLoginLogFrom] = useState('')
  const [loginLogTo, setLoginLogTo] = useState('')
  const [squareUsage, setSquareUsage] = useState<AdminSquareUsage | null>(null)
  const [squareConfig, setSquareConfig] = useState<AdminSquareConfig | null>(null)
  const [squareConfigSaving, setSquareConfigSaving] = useState(false)
  const [squareR2Testing, setSquareR2Testing] = useState(false)
  const [squareR2TestResult, setSquareR2TestResult] = useState<AdminSquareR2TestResult | null>(null)
  const [squareShares, setSquareShares] = useState<AdminSquareShare[]>([])
  const [squarePage, setSquarePage] = useState(1)
  const [squareTotal, setSquareTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [userStatusFilter, setUserStatusFilter] = useState('all')
  const [userSegmentFilter, setUserSegmentFilter] = useState('all')
  const [reportFrom, setReportFrom] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 29)
    return date.toISOString().slice(0, 10)
  })
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [ledgerQuery, setLedgerQuery] = useState('')
  const [ledgerType, setLedgerType] = useState('all')
  const [ledgerFrom, setLedgerFrom] = useState('')
  const [ledgerTo, setLedgerTo] = useState('')
  const [redeemCodeQuery, setRedeemCodeQuery] = useState('')
  const [redeemCodeStatus, setRedeemCodeStatus] = useState('all')
  const [orderQuery, setOrderQuery] = useState('')
  const [orderStatus, setOrderStatus] = useState('all')
  const [ticketQuery, setTicketQuery] = useState('')
  const [ticketStatus, setTicketStatus] = useState('all')
  const [ticketPriority, setTicketPriority] = useState('all')
  const [moderationQuery, setModerationQuery] = useState('')
  const [moderationEnabledFilter, setModerationEnabledFilter] = useState('all')
  const [taskQuery, setTaskQuery] = useState('')
  const [taskStatus, setTaskStatus] = useState('all')
  const [taskModelFilter, setTaskModelFilter] = useState('all')
  const [taskFrom, setTaskFrom] = useState('')
  const [taskTo, setTaskTo] = useState('')
  const [modelQuery, setModelQuery] = useState('')
  const [modelStatusFilter, setModelStatusFilter] = useState('all')
  const [modelProviderFilter, setModelProviderFilter] = useState('all')
  const [modelHealthFilter, setModelHealthFilter] = useState('all')
  const [upstreamQuery, setUpstreamQuery] = useState('')
  const [upstreamStatusFilter, setUpstreamStatusFilter] = useState('all')
  const [upstreamHealthFilter, setUpstreamHealthFilter] = useState('all')
  const [squareStatus, setSquareStatus] = useState('all')
  const [squareKind, setSquareKind] = useState('all')
  const [squareQuery, setSquareQuery] = useState('')
  const [announcementQuery, setAnnouncementQuery] = useState('')
  const [announcementStatusFilter, setAnnouncementStatusFilter] = useState('all')
  const [announcementPlacementFilter, setAnnouncementPlacementFilter] = useState('all')
  const [announcementLevelFilter, setAnnouncementLevelFilter] = useState('all')
  const [selectedSquareShareIds, setSelectedSquareShareIds] = useState<string[]>([])
  const [squareBatchOperating, setSquareBatchOperating] = useState(false)
  const [selectedSquareShareId, setSelectedSquareShareId] = useState<string | null>(null)
  const [selectedAuditLogId, setSelectedAuditLogId] = useState<string | null>(null)
  const [selectedLoginLogId, setSelectedLoginLogId] = useState<string | null>(null)
  const [editingModelId, setEditingModelId] = useState<string | null>(null)
  const [modelDraft, setModelDraft] = useState<ModelDraft>(emptyModelDraft)
  const [editingUpstreamId, setEditingUpstreamId] = useState<string | null>(null)
  const [upstreamDraft, setUpstreamDraft] = useState<UpstreamDraft>(emptyUpstreamDraft)
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null)
  const [announcementDraft, setAnnouncementDraft] = useState<AnnouncementDraft>(emptyAnnouncementDraft)
  const [editingRedeemCodeId, setEditingRedeemCodeId] = useState<string | null>(null)
  const [redeemCodeDraft, setRedeemCodeDraft] = useState<RedeemCodeDraft>(emptyRedeemCodeDraft)
  const [editingCreditPackageId, setEditingCreditPackageId] = useState<string | null>(null)
  const [creditPackageDraft, setCreditPackageDraft] = useState<CreditPackageDraft>(emptyCreditPackageDraft)
  const [editingModerationRuleId, setEditingModerationRuleId] = useState<string | null>(null)
  const [moderationRuleDraft, setModerationRuleDraft] = useState<ModerationRuleDraft>(emptyModerationRuleDraft)
  const [activeEditor, setActiveEditor] = useState<AdminEditor>(null)
  const [creditDelta, setCreditDelta] = useState('100')
  const [creditReason, setCreditReason] = useState('运营补发')
  const [passwordDraft, setPasswordDraft] = useState('')
  const [userOpsDraft, setUserOpsDraft] = useState<{ segment: AdminUserSummary['segment']; adminNote: string }>({
    segment: 'normal',
    adminNote: '',
  })

  const activeNav = useMemo(() => navItems.find((item) => item.id === tab) ?? navItems[0], [tab])
  const activeNavGroupId = useMemo(() => navGroups.find((group) => group.items.some((item) => item.id === tab))?.id ?? navGroups[0]?.id ?? 'insight', [tab])
  const filteredUpstreams = useMemo(() => {
    const text = upstreamQuery.trim().toLowerCase()
    return upstreams.filter((provider) => {
      const health = upstreamHealthSnapshot(provider, upstreamTests[provider.id])
      const haystack = [
        provider.name,
        provider.baseUrl,
        provider.notes,
        provider.lastHealthMessage,
        ...(provider.models ?? []).flatMap((model) => [model.name, model.displayName, `${model.costCredits}`]),
      ].filter(Boolean).join(' ').toLowerCase()
      const matchesQuery = !text || haystack.includes(text)
      const matchesStatus = upstreamStatusFilter === 'all'
        || (upstreamStatusFilter === 'enabled' && provider.enabled)
        || (upstreamStatusFilter === 'disabled' && !provider.enabled)
      const matchesHealth = upstreamHealthFilter === 'all' || health.status === upstreamHealthFilter
      return matchesQuery && matchesStatus && matchesHealth
    })
  }, [upstreams, upstreamTests, upstreamQuery, upstreamStatusFilter, upstreamHealthFilter])

  useEffect(() => {
    const visibleIds = new Set(filteredUpstreams.map((provider) => provider.id))
    setSelectedUpstreamIds((prev) => prev.filter((id) => visibleIds.has(id)))
  }, [filteredUpstreams])

  useEffect(() => {
    setExpandedNavGroupIds((prev) => prev.includes(activeNavGroupId) ? prev : [...prev, activeNavGroupId])
  }, [activeNavGroupId])

  function compactUserAgent(value?: string | null) {
    if (!value) return '-'
    if (value.includes('Edg/')) return 'Edge'
    if (value.includes('Chrome/')) return 'Chrome'
    if (value.includes('Firefox/')) return 'Firefox'
    if (value.includes('Safari/')) return 'Safari'
    return value.slice(0, 32)
  }

  function orderStatusLabel(status: CreditOrder['status']) {
    if (status === 'paid') return '已支付'
    if (status === 'cancelled') return '已取消'
    return '待确认'
  }

  function orderStatusTone(status: CreditOrder['status']): 'green' | 'amber' | 'gray' {
    if (status === 'paid') return 'green'
    if (status === 'cancelled') return 'gray'
    return 'amber'
  }

  function formatPrice(cents: number, currency: string) {
    return `${currency} ${(cents / 100).toFixed(2)}`
  }

  function confirmAdminAction(input: {
    title: string
    message: string
    confirmText?: string
    action: () => void | Promise<void>
  }) {
    setConfirmDialog(input)
  }

  const filteredModels = useMemo(() => {
    const normalizedQuery = modelQuery.trim().toLowerCase()
    return models.filter((model) => {
      const matchesQuery = !normalizedQuery || [
        model.displayName,
        model.name,
        model.description,
        model.upstreamModel,
        model.upstreamProvider?.name ?? '',
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
      const matchesStatus = modelStatusFilter === 'all' || (modelStatusFilter === 'enabled' ? model.enabled : !model.enabled)
      const providerKey = model.upstreamProviderId ?? 'default'
      const matchesProvider = modelProviderFilter === 'all' || modelProviderFilter === providerKey
      const healthKey = model.upstreamProvider?.lastHealthStatus ?? 'unknown'
      const matchesHealth = modelHealthFilter === 'all' || modelHealthFilter === healthKey || (modelHealthFilter === 'default' && !model.upstreamProvider)
      return matchesQuery && matchesStatus && matchesProvider && matchesHealth
    })
  }, [modelHealthFilter, modelProviderFilter, modelQuery, modelStatusFilter, models])
  const filteredAnnouncements = useMemo(() => {
    const normalizedQuery = announcementQuery.trim().toLowerCase()
    return announcements.filter((item) => {
      const matchesQuery = !normalizedQuery || [
        item.title,
        item.content,
        item.actionLabel,
        item.actionUrl,
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
      const matchesStatus = announcementStatusFilter === 'all' || item.status === announcementStatusFilter
      const matchesPlacement = announcementPlacementFilter === 'all' || item.placement === announcementPlacementFilter
      const matchesLevel = announcementLevelFilter === 'all' || item.level === announcementLevelFilter
      return matchesQuery && matchesStatus && matchesPlacement && matchesLevel
    })
  }, [announcementLevelFilter, announcementPlacementFilter, announcementQuery, announcementStatusFilter, announcements])
  const moderationPatternError = useMemo(() => {
    if (moderationRuleDraft.type !== 'regex' || !moderationRuleDraft.pattern.trim()) return ''
    try {
      new RegExp(moderationRuleDraft.pattern, 'i')
      return ''
    } catch {
      return '正则表达式无效，请检查括号、转义和量词'
    }
  }, [moderationRuleDraft.pattern, moderationRuleDraft.type])

  async function loadAll(nextTab = tab) {
    setLoading(true)
    try {
      if (nextTab === 'overview') {
        const [overviewResult, squareUsageResult, squarePendingResult] = await Promise.all([
          platformApi.getAdminOverview(),
          platformApi.getAdminSquareUsage().catch(() => null),
          platformApi.listAdminSquareShares({ status: 'pending_review', limit: 5 }).catch(() => ({ items: [] as AdminSquareShare[] })),
        ])
        setOverview(overviewResult)
        setOverviewSquareUsage(squareUsageResult)
        setOverviewSquarePendingShares(squarePendingResult.items)
      }
      if (nextTab === 'reports') {
        setUsageReport(await platformApi.getAdminUsageReport({
          from: reportFrom ? `${reportFrom}T00:00:00.000` : undefined,
          to: reportTo ? `${reportTo}T23:59:59.999` : undefined,
        }))
      }
      if (nextTab === 'users') {
        const result = await platformApi.listAdminUsers({ q: query, role: userRoleFilter, status: userStatusFilter, segment: userSegmentFilter, page: usersPage, pageSize: adminPageSize })
        setUsers(result.items)
        setUsersTotal(result.total)
        setSelectedUserIds((prev) => prev.filter((id) => result.items.some((item) => item.id === id)))
        const stillVisible = selectedUserId && result.items.some((item) => item.id === selectedUserId)
        if (!stillVisible) {
          const firstUserId = result.items[0]?.id ?? null
          setSelectedUserId(firstUserId)
          setSelectedUserDetail(null)
          if (firstUserId) void loadUserDetail(firstUserId)
        }
      }
      if (nextTab === 'loginLogs') {
        const result = await platformApi.listAdminLoginLogs({
          q: loginLogQuery,
          success: loginLogSuccess,
          from: loginLogFrom ? `${loginLogFrom}T00:00:00.000` : undefined,
          to: loginLogTo ? `${loginLogTo}T23:59:59.999` : undefined,
          page: loginLogPage,
          pageSize: adminPageSize,
        })
        setLoginLogs(result.items)
        setLoginLogTotal(result.total)
        if (selectedLoginLogId && !result.items.some((item) => item.id === selectedLoginLogId)) {
          setSelectedLoginLogId(null)
        }
      }
      if (nextTab === 'credits') {
        const result = await platformApi.listAdminCreditLedger({
          q: ledgerQuery,
          type: ledgerType,
          from: ledgerFrom ? `${ledgerFrom}T00:00:00.000` : undefined,
          to: ledgerTo ? `${ledgerTo}T23:59:59.999` : undefined,
          page: ledgerPage,
          pageSize: adminPageSize,
        })
        setCreditLedgers(result.items)
        setLedgerTotal(result.total)
        if (selectedLedgerId && !result.items.some((item) => item.id === selectedLedgerId)) {
          setSelectedLedgerId(null)
        }
      }
      if (nextTab === 'redeemCodes') {
        const result = await platformApi.listAdminRedeemCodes({
          q: redeemCodeQuery,
          status: redeemCodeStatus,
          page: redeemCodePage,
          pageSize: adminPageSize,
        })
        setRedeemCodes(result.items)
        setRedeemCodeTotal(result.total)
      }
      if (nextTab === 'billing') {
        const [packagesResult, ordersResult] = await Promise.all([
          platformApi.listAdminCreditPackages(),
          platformApi.listAdminCreditOrders({
            q: orderQuery,
            status: orderStatus,
            page: orderPage,
            pageSize: adminPageSize,
          }),
        ])
        setCreditPackages(packagesResult.items)
        setCreditOrders(ordersResult.items)
        setOrderTotal(ordersResult.total)
      }
      if (nextTab === 'tickets') {
        const result = await platformApi.listAdminSupportTickets({
          q: ticketQuery,
          status: ticketStatus,
          priority: ticketPriority,
          page: ticketPage,
          pageSize: adminPageSize,
        })
        setSupportTickets(result.items)
        setTicketTotal(result.total)
        if (selectedTicketId && !result.items.some((item) => item.id === selectedTicketId)) setSelectedTicketId(null)
      }
      if (nextTab === 'moderation') {
        const result = await platformApi.listAdminModerationRules({
          q: moderationQuery,
          enabled: moderationEnabledFilter,
        })
        setModerationRules(result.items)
      }
      if (nextTab === 'tasks') {
        const [result, modelResult] = await Promise.all([
          platformApi.listAdminTasks({
            status: taskStatus,
            q: taskQuery,
            modelConfigId: taskModelFilter,
            from: taskFrom ? `${taskFrom}T00:00:00.000` : undefined,
            to: taskTo ? `${taskTo}T23:59:59.999` : undefined,
            page: tasksPage,
            pageSize: adminPageSize,
          }),
          platformApi.listAdminModels(),
        ])
        setTasks(result.items)
        setTasksTotal(result.total)
        setLocalModels(modelResult.models)
        setSelectedTaskIds((prev) => prev.filter((id) => result.items.some((item) => item.id === id)))
        if (selectedTaskId && !result.items.some((item) => item.id === selectedTaskId)) {
          setSelectedTaskId(null)
        }
      }
      if (nextTab === 'models') {
        setModelLoadError('')
        const [modelResult, upstreamResult] = await Promise.all([
          platformApi.listAdminModels(),
          platformApi.listAdminUpstreams(),
        ])
        setLocalModels(modelResult.models)
        setSelectedModelIds((prev) => prev.filter((id) => modelResult.models.some((item) => item.id === id)))
        setUpstreams(upstreamResult.items)
      }
      if (nextTab === 'upstreams') {
        const result = await platformApi.listAdminUpstreams()
        setUpstreams(result.items)
        setSelectedUpstreamIds((prev) => prev.filter((id) => result.items.some((item) => item.id === id)))
      }
      if (nextTab === 'square') {
        const [configResult, usage, shares] = await Promise.all([
          platformApi.getAdminSquareConfig(),
          platformApi.getAdminSquareUsage(),
          platformApi.listAdminSquareShares({
            status: squareStatus,
            kind: squareKind,
            q: squareQuery,
            page: squarePage,
            pageSize: adminPageSize,
          }),
        ])
        setSquareConfig(configResult.config)
        setSquareUsage(usage)
        setSquareShares(shares.items)
        setSquareTotal(typeof shares.total === 'number' ? shares.total : shares.items.length)
        setSelectedSquareShareIds((prev) => prev.filter((id) => shares.items.some((item) => item.id === id)))
        if (selectedSquareShareId && !shares.items.some((item) => item.id === selectedSquareShareId)) {
          setSelectedSquareShareId(null)
        }
      }
      if (nextTab === 'announcements') {
        const result = await platformApi.listAdminAnnouncements()
        setAnnouncements(result.items)
        setSelectedAnnouncementIds((prev) => prev.filter((id) => result.items.some((item) => item.id === id)))
        if (selectedAnnouncementId && !result.items.some((item) => item.id === selectedAnnouncementId)) setSelectedAnnouncementId(null)
      }
      if (nextTab === 'settings') setSettingsDraft((await platformApi.getAdminSettings()).settings)
      if (nextTab === 'audit') {
        const result = await platformApi.listAdminAuditLogs({
          q: auditQuery,
          action: auditAction,
          from: auditFrom ? `${auditFrom}T00:00:00.000` : undefined,
          to: auditTo ? `${auditTo}T23:59:59.999` : undefined,
          page: auditPage,
          pageSize: adminPageSize,
        })
        setAuditLogs(result.items)
        setAuditTotal(result.total)
        if (selectedAuditLogId && !result.items.some((item) => item.id === selectedAuditLogId)) {
          setSelectedAuditLogId(null)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '后台数据加载失败'
      if (nextTab === 'models') setModelLoadError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && authReady && currentUser?.role === 'admin') void loadAll(tab)
  }, [open, tab, authReady, currentUser?.role])

  useEffect(() => {
    if (open && tab === 'users') {
      if (usersPage !== 1) {
        setUsersPage(1)
        return
      }
      setUsersPage(1)
      const id = window.setTimeout(() => void loadAll('users'), 300)
      return () => window.clearTimeout(id)
    }
  }, [query, userRoleFilter, userStatusFilter, userSegmentFilter])

  useEffect(() => {
    if (open && tab === 'loginLogs') {
      if (loginLogPage !== 1) {
        setLoginLogPage(1)
        return
      }
      setLoginLogPage(1)
      const id = window.setTimeout(() => void loadAll('loginLogs'), 300)
      return () => window.clearTimeout(id)
    }
  }, [loginLogQuery, loginLogSuccess, loginLogFrom, loginLogTo])

  useEffect(() => {
    if (open && tab === 'square') {
      if (squarePage !== 1) {
        setSquarePage(1)
        return
      }
      setSquarePage(1)
      const id = window.setTimeout(() => void loadAll('square'), 300)
      return () => window.clearTimeout(id)
    }
  }, [squareQuery, squareStatus, squareKind])

  useEffect(() => {
    if (open && tab === 'reports') {
      const id = window.setTimeout(() => void loadAll('reports'), 300)
      return () => window.clearTimeout(id)
    }
  }, [reportFrom, reportTo])

  useEffect(() => {
    if (open && tab === 'announcements') {
      setSelectedAnnouncementIds((prev) => prev.filter((id) => filteredAnnouncements.some((item) => item.id === id)))
    }
  }, [filteredAnnouncements, open, tab])

  useEffect(() => {
    if (open && tab === 'models') {
      setSelectedModelIds((prev) => prev.filter((id) => filteredModels.some((item) => item.id === id)))
    }
  }, [filteredModels, open, tab])

  useEffect(() => {
    if (open && tab === 'tasks') {
      if (tasksPage !== 1) {
        setTasksPage(1)
        return
      }
      setTasksPage(1)
      const id = window.setTimeout(() => void loadAll('tasks'), 300)
      return () => window.clearTimeout(id)
    }
  }, [taskQuery, taskStatus, taskModelFilter, taskFrom, taskTo])

  useEffect(() => {
    if (open && tab === 'credits') {
      if (ledgerPage !== 1) {
        setLedgerPage(1)
        return
      }
      setLedgerPage(1)
      const id = window.setTimeout(() => void loadAll('credits'), 300)
      return () => window.clearTimeout(id)
    }
  }, [ledgerQuery, ledgerType, ledgerFrom, ledgerTo])

  useEffect(() => {
    if (open && tab === 'redeemCodes') {
      if (redeemCodePage !== 1) {
        setRedeemCodePage(1)
        return
      }
      setRedeemCodePage(1)
      const id = window.setTimeout(() => void loadAll('redeemCodes'), 300)
      return () => window.clearTimeout(id)
    }
  }, [redeemCodeQuery, redeemCodeStatus])

  useEffect(() => {
    if (open && tab === 'billing') {
      if (orderPage !== 1) {
        setOrderPage(1)
        return
      }
      setOrderPage(1)
      const id = window.setTimeout(() => void loadAll('billing'), 300)
      return () => window.clearTimeout(id)
    }
  }, [orderQuery, orderStatus])

  useEffect(() => {
    if (open && tab === 'tickets') {
      if (ticketPage !== 1) {
        setTicketPage(1)
        return
      }
      setTicketPage(1)
      const id = window.setTimeout(() => void loadAll('tickets'), 300)
      return () => window.clearTimeout(id)
    }
  }, [ticketQuery, ticketStatus, ticketPriority])

  useEffect(() => {
    if (open && tab === 'moderation') {
      const id = window.setTimeout(() => void loadAll('moderation'), 300)
      return () => window.clearTimeout(id)
    }
  }, [moderationQuery, moderationEnabledFilter])

  useEffect(() => {
    if (open && tab === 'users') void loadAll('users')
  }, [usersPage])

  useEffect(() => {
    if (open && tab === 'loginLogs') void loadAll('loginLogs')
  }, [loginLogPage])

  useEffect(() => {
    if (open && tab === 'credits') void loadAll('credits')
  }, [ledgerPage])

  useEffect(() => {
    if (open && tab === 'redeemCodes') void loadAll('redeemCodes')
  }, [redeemCodePage])

  useEffect(() => {
    if (open && tab === 'billing') void loadAll('billing')
  }, [orderPage])

  useEffect(() => {
    if (open && tab === 'tickets') void loadAll('tickets')
  }, [ticketPage])

  useEffect(() => {
    if (open && tab === 'tasks') void loadAll('tasks')
  }, [tasksPage])

  useEffect(() => {
    if (open && tab === 'square') void loadAll('square')
  }, [squarePage])

  useEffect(() => {
    if (open && tab === 'audit') void loadAll('audit')
  }, [auditPage])

  useEffect(() => {
    if (open && tab === 'audit') {
      if (auditPage !== 1) {
        setAuditPage(1)
        return
      }
      setAuditPage(1)
      const id = window.setTimeout(() => void loadAll('audit'), 300)
      return () => window.clearTimeout(id)
    }
  }, [auditQuery, auditAction, auditFrom, auditTo])

  useEffect(() => {
    if (open && tab === 'users' && selectedUserId) void loadUserDetail(selectedUserId)
  }, [open, tab, selectedUserId])

  if (!open) return null

  function closeAdminConsole() {
    if (window.location.pathname === '/admin') {
      window.history.pushState(null, '', '/')
    }
    setOpen(false)
  }

  function toggleNavGroup(groupId: string) {
    setExpandedNavGroupIds((prev) => {
      if (groupId === activeNavGroupId) return prev.includes(groupId) ? prev : [...prev, groupId]
      return prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    })
  }

  function jumpToBilling(search = '', status = 'pending') {
    setOrderQuery(search)
    setOrderStatus(status)
    setOrderPage(1)
    setTab('billing')
  }

  function jumpToTickets(search = '', status = 'open', priority = 'all') {
    setTicketQuery(search)
    setTicketStatus(status)
    setTicketPriority(priority)
    setTicketPage(1)
    setTab('tickets')
  }

  function jumpToTasks(search = '', status = 'error') {
    setTaskQuery(search)
    setTaskStatus(status)
    setTaskModelFilter('all')
    setTasksPage(1)
    setTab('tasks')
  }

  function jumpToSquare(search = '', status = 'pending_review') {
    setSquareQuery(search)
    setSquareStatus(status)
    setSquareKind('all')
    setTab('square')
  }

  function jumpToUsers(search = '', status = 'all', segment = 'all') {
    setQuery(search)
    setUserRoleFilter('all')
    setUserStatusFilter(status)
    setUserSegmentFilter(segment)
    setUsersPage(1)
    setTab('users')
  }

  function jumpToUpstream(provider?: AdminUpstreamProvider) {
    setTab('upstreams')
    if (provider) window.setTimeout(() => openUpstreamEditor(provider), 0)
  }

  if (!authReady || currentUser?.role !== 'admin') {
    const needsLogin = authReady && !currentUser
    const forbidden = authReady && currentUser && currentUser.role !== 'admin'
    return (
      <div className="fixed inset-0 z-[90] grid place-items-center bg-[#f5f7fb] px-4 text-gray-950 dark:bg-gray-950 dark:text-gray-50">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl shadow-gray-950/10 dark:border-white/[0.08] dark:bg-gray-900">
          <div className="border-b border-gray-100 bg-gray-50 px-6 py-5 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <div className="text-sm font-semibold text-gray-400">GPT Image Playground Admin</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {!authReady && '正在检查登录状态'}
              {needsLogin && '登录后进入运营后台'}
              {forbidden && '当前账号无后台权限'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              {!authReady && '正在同步服务端会话，请稍候。'}
              {needsLogin && '运营后台只向管理员开放，登录管理员账号后会自动进入。'}
              {forbidden && '请使用管理员账号登录，或返回前台继续使用图片生成工作台。'}
            </p>
          </div>
          <div className="space-y-3 px-6 py-5">
            {needsLogin && (
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="h-11 w-full rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-gray-950"
              >
                登录管理员账号
              </button>
            )}
            <button
              type="button"
              onClick={closeAdminConsole}
              className="h-11 w-full rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100 dark:hover:bg-white/[0.08]"
            >
              返回前台
            </button>
          </div>
        </div>
      </div>
    )
  }

  async function refreshPublicModels() {
    const result = await platformApi.listModels()
    setModels(result.models)
  }

  async function loadUserDetail(userId: string) {
    setUserDetailLoading(true)
    try {
      const detail = await platformApi.getAdminUser(userId)
      setSelectedUserDetail(detail)
      setUserOpsDraft({
        segment: detail.user.segment,
        adminNote: detail.user.adminNote,
      })
      setCreditDelta('100')
      setCreditReason('运营补发')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '用户详情加载失败', 'error')
    } finally {
      setUserDetailLoading(false)
    }
  }

  async function patchSelectedUser(input: Partial<Pick<AdminUserSummary, 'role' | 'status'>>) {
    if (!selectedUserId) return
    try {
      await platformApi.updateAdminUser(selectedUserId, input)
      await Promise.all([loadAll('users'), loadUserDetail(selectedUserId)])
      showToast('用户状态已更新', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '用户状态更新失败', 'error')
    }
  }

  async function patchUser(userId: string, input: Partial<Pick<AdminUserSummary, 'role' | 'status'>>) {
    try {
      await platformApi.updateAdminUser(userId, input)
      await loadAll('users')
      if (selectedUserId === userId) await loadUserDetail(userId)
      showToast('用户状态已更新', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '用户状态更新失败', 'error')
    }
  }

  async function adjustSelectedUserCredits(event: FormEvent) {
    event.preventDefault()
    if (!selectedUserId) return
    try {
      await platformApi.adjustAdminUserCredits(selectedUserId, {
        delta: Number(creditDelta),
        reason: creditReason,
      })
      await Promise.all([loadAll('users'), loadUserDetail(selectedUserId)])
      showToast('积分已调整', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '积分调整失败', 'error')
    }
  }

  async function resetSelectedUserPassword(event: FormEvent) {
    event.preventDefault()
    if (!selectedUserId) return
    if (passwordDraft.length < 8) {
      showToast('新密码至少 8 位', 'error')
      return
    }
    try {
      await platformApi.resetAdminUserPassword(selectedUserId, { password: passwordDraft })
      await Promise.all([loadAll('users'), loadUserDetail(selectedUserId)])
      setPasswordDraft('')
      setUserDialogMode(null)
      showToast('用户密码已重置', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '密码重置失败', 'error')
    }
  }

  async function saveSelectedUserOpsProfile(event: FormEvent) {
    event.preventDefault()
    if (!selectedUserId) return
    try {
      await platformApi.updateAdminUser(selectedUserId, userOpsDraft)
      await Promise.all([loadAll('users'), loadUserDetail(selectedUserId)])
      showToast('用户运营档案已保存', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '运营档案保存失败', 'error')
    }
  }

  function toggleUserSelection(userId: string) {
    setSelectedUserIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId])
  }

  function toggleCurrentPageUsers(checked: boolean) {
    setSelectedUserIds(checked ? users.map((user) => user.id) : [])
  }

  async function batchUpdateUsersStatus(status: AdminUserSummary['status']) {
    if (!selectedUserIds.length) return
    setBatchOperating(true)
    try {
      const result = await platformApi.updateAdminUsersStatus({ ids: selectedUserIds, status })
      await loadAll('users')
      if (selectedUserId) await loadUserDetail(selectedUserId)
      showToast(`已${status === 'active' ? '恢复' : '禁用'} ${result.affected} 个用户`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量更新失败', 'error')
    } finally {
      setBatchOperating(false)
    }
  }

  async function batchAdjustUsersCredits(event: FormEvent) {
    event.preventDefault()
    if (!selectedUserIds.length) return
    setBatchOperating(true)
    try {
      const result = await platformApi.adjustAdminUsersCredits({
        ids: selectedUserIds,
        delta: Number(batchCreditDelta),
        reason: batchCreditReason,
      })
      await Promise.all([
        loadAll('users'),
        loadAll('credits'),
        selectedUserId ? loadUserDetail(selectedUserId) : Promise.resolve(),
      ])
      showToast(`已调整 ${result.affected} 个用户的积分`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量积分调整失败', 'error')
    } finally {
      setBatchOperating(false)
    }
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((prev) => prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId])
  }

  function toggleCurrentPageTasks(checked: boolean) {
    setSelectedTaskIds(checked ? tasks.map((task) => task.id) : [])
  }

  async function deleteTask(taskId: string) {
    const task = tasks.find((item) => item.id === taskId)
    if (task?.status === 'running') {
      showToast('运行中的任务不能清理', 'error')
      return
    }
    confirmAdminAction({
      title: '清理生成日志',
      message: '确认清理这条生成日志？对应积分流水不会删除。',
      confirmText: '确认清理',
      action: async () => {
        try {
          const result = await platformApi.deleteAdminTask(taskId)
          setSelectedTaskIds((prev) => prev.filter((id) => id !== taskId))
          if (selectedTaskId === taskId) setSelectedTaskId(null)
          await loadAll('tasks')
          showToast(`生成日志已清理，${formatTaskCleanupSummary(result.cleanup)}`, 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '生成日志清理失败', 'error')
        }
      },
    })
  }

  async function batchDeleteTasks() {
    if (!selectedTaskIds.length) return
    const runningCount = tasks.filter((task) => selectedTaskIds.includes(task.id) && task.status === 'running').length
    if (runningCount > 0) {
      showToast(`已选中 ${runningCount} 个运行中任务，不能批量清理`, 'error')
      return
    }
    confirmAdminAction({
      title: '批量清理生成日志',
      message: `确认清理选中的 ${selectedTaskIds.length} 条生成日志？对应积分流水不会删除。`,
      confirmText: '批量清理',
      action: async () => {
        setTaskBatchOperating(true)
        try {
          const result = await platformApi.deleteAdminTasks(selectedTaskIds)
          setSelectedTaskIds([])
          await loadAll('tasks')
          showToast(`已清理 ${result.affected} 条生成日志，${formatTaskCleanupSummary(result.cleanup)}`, 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '批量清理失败', 'error')
        } finally {
          setTaskBatchOperating(false)
        }
      },
    })
  }

  function toggleSquareShareSelection(shareId: string) {
    setSelectedSquareShareIds((prev) => prev.includes(shareId) ? prev.filter((id) => id !== shareId) : [...prev, shareId])
  }

  function toggleCurrentPageSquareShares(checked: boolean) {
    setSelectedSquareShareIds(checked ? squareShares.map((share) => share.id) : [])
  }

  async function batchUpdateSquareSharesStatus(status: AdminSquareShare['status']) {
    if (!selectedSquareShareIds.length) return
    const actionText = status === 'published' ? '公开' : status === 'hidden' ? '隐藏' : status === 'rejected' ? '拒绝' : status === 'deleted' ? '删除' : '设为待审核'
    confirmAdminAction({
      title: '批量处理广场内容',
      message: `确认将选中的 ${selectedSquareShareIds.length} 条广场内容${actionText}？`,
      confirmText: `确认${actionText}`,
      action: async () => {
        setSquareBatchOperating(true)
        try {
          const result = await platformApi.updateAdminSquareSharesStatus(selectedSquareShareIds, status)
          setSelectedSquareShareIds([])
          await Promise.all([loadAll('square'), platformApi.getAdminSquareUsage().then(setSquareUsage)])
          showToast(`已${actionText} ${result.affected} 条广场内容`, 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '批量审核失败', 'error')
        } finally {
          setSquareBatchOperating(false)
        }
      },
    })
  }

  function readTaskAdminMeta(task: AdminGenerationTask): Record<string, unknown> {
    const params = task.params && typeof task.params === 'object' && !Array.isArray(task.params)
      ? task.params as Record<string, unknown>
      : {}
    const meta = params._admin
    return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta as Record<string, unknown> : {}
  }

  function taskOperationMeta(task: AdminGenerationTask): { label: string; tone: 'blue' | 'purple' | 'gray'; isEdit: boolean } {
    const meta = readTaskAdminMeta(task)
    const operation = typeof meta.operation === 'string' ? meta.operation : ''
    if (operation === 'edit') return { label: '编辑', tone: 'purple', isEdit: true }
    if (operation === 'generation') return { label: '生成', tone: 'blue', isEdit: false }
    return { label: '生成', tone: 'blue', isEdit: false }
  }

  function taskReferenceImages(task: AdminGenerationTask): Array<Record<string, unknown>> {
    const meta = readTaskAdminMeta(task)
    return Array.isArray(meta.referenceImages)
      ? meta.referenceImages.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      : []
  }

  function taskRequestParams(task: AdminGenerationTask): unknown {
    if (!task.params || typeof task.params !== 'object' || Array.isArray(task.params)) return task.params
    const { _admin: _internal, ...requestParams } = task.params as Record<string, unknown>
    return requestParams
  }

  function summarizeAdminOutputImages(value: unknown): unknown {
    if (!Array.isArray(value)) return value ?? []
    return value.map((item, index) => {
      if (!item || typeof item !== 'object') return { index, value: item }
      const image = item as Record<string, unknown>
      const dataUrl = typeof image.dataUrl === 'string' ? image.dataUrl : ''
      return {
        index: typeof image.index === 'number' ? image.index : index,
        status: image.status,
        mimeType: image.mimeType,
        error: image.error,
        dataUrl: dataUrl
          ? dataUrl.startsWith('data:')
            ? `[data-url length=${dataUrl.length}]`
            : dataUrl
          : undefined,
      }
    })
  }

  function taskReturnParams(task: AdminGenerationTask): unknown {
    const meta = readTaskAdminMeta(task)
    const upstreamResponse = meta.upstreamResponse
    if (upstreamResponse && typeof upstreamResponse === 'object') return upstreamResponse

    return {
      status: task.status,
      error: task.error ?? null,
      outputImages: summarizeAdminOutputImages(task.outputImages),
      generatedAssets: (task.generatedAssets ?? []).map((asset) => ({
        imageIndex: asset.imageIndex,
        publicUrl: asset.publicUrl,
        r2Key: asset.r2Key,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        width: asset.width,
        height: asset.height,
        uploadMode: asset.uploadMode,
      })),
    }
  }

  async function updateSquareShareStatus(shareId: string, status: AdminSquareShare['status'], successMessage: string, closeAfter = false) {
    confirmAdminAction({
      title: '修改广场内容状态',
      message: `确认将该广场内容状态修改为 ${status}？`,
      confirmText: '确认修改',
      action: async () => {
        try {
          await platformApi.updateAdminSquareShareStatus(shareId, status)
          await loadAll('square')
          showToast(successMessage, 'success')
          if (closeAfter) setSelectedSquareShareId(null)
        } catch (error) {
          showToast(error instanceof Error ? error.message : '状态更新失败', 'error')
        }
      },
    })
  }

  async function cleanupSquareDryRun() {
    try {
      const result = await platformApi.cleanupAdminSquare({ dryRun: true, limit: 20 })
      showToast(formatSquareCleanupPreview(result), 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '清理预检失败', 'error')
    }
  }

  async function cleanupSquareNow() {
    confirmAdminAction({
      title: '执行广场清理',
      message: '确认清理状态为 deleted 的广场内容？系统会同步删除对应 R2 原图和缩略图。',
      confirmText: '执行清理',
      action: async () => {
        try {
          const result = await platformApi.cleanupAdminSquare({ dryRun: false, limit: 50 })
          await loadAll('square')
          showToast(formatSquareCleanupResult(result), 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '广场清理失败', 'error')
        }
      },
    })
  }

  async function saveSquareConfig(input: Partial<AdminSquareConfig> & { squareAdminToken?: string; r2SecretKey?: string }) {
    confirmAdminAction({
      title: '保存广场存储配置',
      message: '确认保存广场 API 与 Cloudflare R2 配置？保存后发布到广场的图片会按新配置写入。',
      confirmText: '保存配置',
      action: async () => {
        setSquareConfigSaving(true)
        try {
          const result = await platformApi.updateAdminSquareConfig(input)
          setSquareConfig(result.config)
          await loadAll('square')
          showToast('广场存储配置已保存', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '广场配置保存失败', 'error')
        } finally {
          setSquareConfigSaving(false)
        }
      },
    })
  }

  async function testSquareR2() {
    setSquareR2Testing(true)
    try {
      const result = await platformApi.testAdminSquareR2()
      setSquareR2TestResult(result.result)
      showToast(`R2 测试成功，耗时 ${result.result.latencyMs}ms`, 'success')
    } catch (error) {
      setSquareR2TestResult(null)
      showToast(error instanceof Error ? error.message : 'R2 测试失败，请检查配置', 'error')
    } finally {
      setSquareR2Testing(false)
    }
  }

  function openModelEditor(model?: ModelConfig) {
    setEditingModelId(model?.id ?? null)
    setModelDraft(model ? ({ ...emptyModelDraft, ...model, upstreamProvider: undefined } as ModelDraft) : emptyModelDraft)
    setActiveEditor('model')
  }

  function openUpstreamEditor(provider?: AdminUpstreamProvider) {
    setEditingUpstreamId(provider?.id ?? null)
    setUpstreamDraft(provider ? { ...provider, apiKey: '' } : emptyUpstreamDraft)
    setActiveEditor('upstream')
  }

  function openAnnouncementEditor(announcement?: AdminAnnouncement) {
    setEditingAnnouncementId(announcement?.id ?? null)
    setAnnouncementDraft(announcement ?? emptyAnnouncementDraft)
    setActiveEditor('announcement')
  }

  function openRedeemCodeEditor(redeemCode?: AdminRedeemCode) {
    setEditingRedeemCodeId(redeemCode?.id ?? null)
    setRedeemCodeDraft(redeemCode ? {
      code: redeemCode.code,
      name: redeemCode.name,
      credits: redeemCode.credits,
      maxRedemptions: redeemCode.maxRedemptions,
      perUserLimit: redeemCode.perUserLimit,
      status: redeemCode.status,
      startsAt: redeemCode.startsAt ?? null,
      endsAt: redeemCode.endsAt ?? null,
      note: redeemCode.note,
    } : emptyRedeemCodeDraft)
    setActiveEditor('redeemCode')
  }

  function openCreditPackageEditor(pack?: CreditPackage) {
    setEditingCreditPackageId(pack?.id ?? null)
    setCreditPackageDraft(pack ? {
      name: pack.name,
      description: pack.description,
      credits: pack.credits,
      bonusCredits: pack.bonusCredits,
      priceCents: pack.priceCents,
      currency: pack.currency,
      badge: pack.badge,
      enabled: pack.enabled,
      sortOrder: pack.sortOrder,
    } : emptyCreditPackageDraft)
    setActiveEditor('creditPackage')
  }

  function openModerationRuleEditor(rule?: ModerationRule) {
    setEditingModerationRuleId(rule?.id ?? null)
    setModerationRuleDraft(rule ? {
      name: rule.name,
      type: rule.type,
      pattern: rule.pattern,
      action: rule.action,
      message: rule.message,
      enabled: rule.enabled,
      priority: rule.priority,
      note: rule.note,
    } : emptyModerationRuleDraft)
    setActiveEditor('moderationRule')
  }

  function closeEditor() {
    setActiveEditor(null)
    setEditingModelId(null)
    setEditingUpstreamId(null)
    setEditingAnnouncementId(null)
    setEditingRedeemCodeId(null)
    setEditingCreditPackageId(null)
    setEditingModerationRuleId(null)
  }

  async function saveModel(event: FormEvent) {
    event.preventDefault()
    confirmAdminAction({
      title: editingModelId ? '保存模型配置' : '创建模型配置',
      message: '确认保存当前模型配置？保存后前台模型列表会同步更新。',
      confirmText: '保存',
      action: async () => {
        try {
          const nextDraft: ModelDraft = modelDraft.name === 'gpt-image-2'
            ? modelDraft
            : { ...modelDraft, highQualityEnabled: false }
          if (editingModelId) await platformApi.updateAdminModel(editingModelId, nextDraft)
          else await platformApi.createAdminModel(nextDraft)
          closeEditor()
          setModelDraft(emptyModelDraft)
          await loadAll('models')
          await refreshPublicModels()
          showToast('模型配置已保存', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '模型保存失败', 'error')
        }
      },
    })
  }

  async function saveUpstream(event: FormEvent) {
    event.preventDefault()
    confirmAdminAction({
      title: editingUpstreamId ? '保存上游渠道' : '创建上游渠道',
      message: '确认保存当前上游渠道配置？关联模型会继续使用该渠道发起请求。',
      confirmText: '保存',
      action: async () => {
        try {
          if (editingUpstreamId) await platformApi.updateAdminUpstream(editingUpstreamId, upstreamDraft)
          else await platformApi.createAdminUpstream(upstreamDraft)
          closeEditor()
          setUpstreamDraft(emptyUpstreamDraft)
          await loadAll('upstreams')
          showToast('上游渠道已保存', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '上游保存失败', 'error')
        }
      },
    })
  }

  async function saveAnnouncement(event: FormEvent) {
    event.preventDefault()
    confirmAdminAction({
      title: editingAnnouncementId ? '保存公告' : '创建公告',
      message: '确认保存当前公告？发布状态的公告会在前台展示。',
      confirmText: '保存',
      action: async () => {
        try {
          if (editingAnnouncementId) await platformApi.updateAdminAnnouncement(editingAnnouncementId, announcementDraft)
          else await platformApi.createAdminAnnouncement(announcementDraft)
          closeEditor()
          setAnnouncementDraft(emptyAnnouncementDraft)
          await loadAll('announcements')
          showToast('公告已保存', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '公告保存失败', 'error')
        }
      },
    })
  }

  async function saveRedeemCode(event: FormEvent) {
    event.preventDefault()
    confirmAdminAction({
      title: editingRedeemCodeId ? '保存兑换码' : '创建兑换码',
      message: '确认保存当前兑换码？用户兑换后会立即影响积分余额。',
      confirmText: '保存',
      action: async () => {
        try {
          if (editingRedeemCodeId) await platformApi.updateAdminRedeemCode(editingRedeemCodeId, redeemCodeDraft)
          else await platformApi.createAdminRedeemCode(redeemCodeDraft)
          closeEditor()
          setRedeemCodeDraft(emptyRedeemCodeDraft)
          await loadAll('redeemCodes')
          showToast('兑换码已保存', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '兑换码保存失败', 'error')
        }
      },
    })
  }

  async function saveCreditPackage(event: FormEvent) {
    event.preventDefault()
    confirmAdminAction({
      title: editingCreditPackageId ? '保存积分套餐' : '创建积分套餐',
      message: '确认保存当前套餐？上架套餐会展示给前台用户下单。',
      confirmText: '保存',
      action: async () => {
        try {
          if (editingCreditPackageId) await platformApi.updateAdminCreditPackage(editingCreditPackageId, creditPackageDraft)
          else await platformApi.createAdminCreditPackage(creditPackageDraft)
          closeEditor()
          setCreditPackageDraft(emptyCreditPackageDraft)
          await loadAll('billing')
          showToast('积分套餐已保存', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '积分套餐保存失败', 'error')
        }
      },
    })
  }

  async function saveModerationRule(event: FormEvent) {
    event.preventDefault()
    confirmAdminAction({
      title: editingModerationRuleId ? '保存风控规则' : '创建风控规则',
      message: '确认保存当前风控规则？启用后会参与生成前校验。',
      confirmText: '保存',
      action: async () => {
        try {
          if (editingModerationRuleId) await platformApi.updateAdminModerationRule(editingModerationRuleId, moderationRuleDraft)
          else await platformApi.createAdminModerationRule(moderationRuleDraft)
          closeEditor()
          setModerationRuleDraft(emptyModerationRuleDraft)
          await loadAll('moderation')
          showToast('风控规则已保存', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '风控规则保存失败', 'error')
        }
      },
    })
  }

  async function deleteModel() {
    if (!editingModelId) return
    confirmAdminAction({
      title: '删除模型',
      message: '确认删除该模型？如果已有任务使用它，系统会改为停用。',
      confirmText: '删除',
      action: async () => {
        try {
          await platformApi.deleteAdminModel(editingModelId)
          closeEditor()
          await loadAll('models')
          await refreshPublicModels()
          showToast('模型已删除或停用', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '模型删除失败', 'error')
        }
      },
    })
  }

  async function deleteModelById(modelId: string) {
    confirmAdminAction({
      title: '删除模型',
      message: '确认删除该模型？如果已有任务使用它，系统会改为停用。',
      confirmText: '删除',
      action: async () => {
        try {
          await platformApi.deleteAdminModel(modelId)
          await loadAll('models')
          await refreshPublicModels()
          setSelectedModelIds((prev) => prev.filter((id) => id !== modelId))
          showToast('模型已删除或停用', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '模型删除失败', 'error')
        }
      },
    })
  }

  async function patchModel(modelId: string, input: Partial<Pick<ModelConfig, 'enabled' | 'isNew'>>, successMessage: string) {
    confirmAdminAction({
      title: '修改模型配置',
      message: '确认修改该模型配置？保存后前台模型列表会同步变化。',
      confirmText: '确认修改',
      action: async () => {
        try {
          await platformApi.updateAdminModel(modelId, input)
          await loadAll('models')
          await refreshPublicModels()
          showToast(successMessage, 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '模型更新失败', 'error')
        }
      },
    })
  }

  function toggleModelSelection(modelId: string) {
    setSelectedModelIds((prev) => prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId])
  }

  function toggleCurrentPageModels(checked: boolean) {
    setSelectedModelIds(checked ? filteredModels.map((model) => model.id) : [])
  }

  async function batchPatchModels(input: Partial<Pick<ModelConfig, 'enabled' | 'isNew'>>) {
    if (!selectedModelIds.length) return
    confirmAdminAction({
      title: '批量修改模型',
      message: `确认批量修改选中的 ${selectedModelIds.length} 个模型？`,
      confirmText: '批量修改',
      action: async () => {
        setModelBatchOperating(true)
        try {
          await Promise.all(selectedModelIds.map((id) => platformApi.updateAdminModel(id, input)))
          await loadAll('models')
          await refreshPublicModels()
          showToast(`已更新 ${selectedModelIds.length} 个模型`, 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '模型批量更新失败', 'error')
        } finally {
          setModelBatchOperating(false)
        }
      },
    })
  }

  async function deleteUpstream() {
    if (!editingUpstreamId) return
    confirmAdminAction({
      title: '删除上游渠道',
      message: '确认删除该上游渠道？如果已有模型绑定，系统会改为停用。',
      confirmText: '删除',
      action: async () => {
        try {
          await platformApi.deleteAdminUpstream(editingUpstreamId)
          closeEditor()
          await loadAll('upstreams')
          showToast('上游渠道已删除或停用', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '上游删除失败', 'error')
        }
      },
    })
  }

  async function testUpstream(providerId: string) {
    setTestingUpstreamId(providerId)
    try {
      const { result } = await platformApi.testAdminUpstream(providerId)
      setUpstreamTests((prev) => ({ ...prev, [providerId]: result }))
      await loadAll('upstreams')
      showToast(result.ok ? `渠道测试成功，延迟 ${result.latencyMs}ms` : result.message, result.ok ? 'success' : 'error')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '渠道测试失败', 'error')
    } finally {
      setTestingUpstreamId(null)
    }
  }

  function toggleUpstreamSelection(providerId: string) {
    setSelectedUpstreamIds((prev) => prev.includes(providerId) ? prev.filter((id) => id !== providerId) : [...prev, providerId])
  }

  function toggleCurrentPageUpstreams(checked: boolean) {
    setSelectedUpstreamIds(checked ? filteredUpstreams.map((provider) => provider.id) : [])
  }

  async function batchTestUpstreams(scope: 'selected' | 'all') {
    const ids = scope === 'selected' ? selectedUpstreamIds : undefined
    if (scope === 'selected' && !selectedUpstreamIds.length) return
    setUpstreamBatchTesting(true)
    try {
      const { results } = await platformApi.testAdminUpstreams(ids)
      setUpstreamTests((prev) => {
        const next = { ...prev }
        for (const result of results) next[result.providerId] = result
        return next
      })
      await loadAll('upstreams')
      const healthy = results.filter((item) => item.ok).length
      const failed = results.length - healthy
      showToast(`已检测 ${results.length} 个渠道：${healthy} 个可用，${failed} 个异常`, failed ? 'error' : 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量检测失败', 'error')
    } finally {
      setUpstreamBatchTesting(false)
    }
  }

  async function deleteAnnouncement() {
    if (!editingAnnouncementId) return
    confirmAdminAction({
      title: '删除公告',
      message: '确认删除该公告？删除后前台将不再展示。',
      confirmText: '删除',
      action: async () => {
        try {
          await platformApi.deleteAdminAnnouncement(editingAnnouncementId)
          closeEditor()
          await loadAll('announcements')
          showToast('公告已删除', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '公告删除失败', 'error')
        }
      },
    })
  }

  async function patchAnnouncement(id: string, input: Partial<Pick<AdminAnnouncement, 'status' | 'pinned'>>, successMessage: string, closeAfter = false) {
    confirmAdminAction({
      title: '修改公告',
      message: '确认修改该公告？发布、归档或置顶状态会影响前台展示。',
      confirmText: '确认修改',
      action: async () => {
        try {
          await platformApi.updateAdminAnnouncement(id, input)
          await loadAll('announcements')
          showToast(successMessage, 'success')
          if (closeAfter) setSelectedAnnouncementId(null)
        } catch (error) {
          showToast(error instanceof Error ? error.message : '公告状态更新失败', 'error')
        }
      },
    })
  }

  async function patchRedeemCode(id: string, input: Partial<RedeemCodeDraft>) {
    confirmAdminAction({
      title: '修改兑换码',
      message: '确认修改该兑换码？用户兑换规则会立即按新配置生效。',
      confirmText: '确认修改',
      action: async () => {
        try {
          await platformApi.updateAdminRedeemCode(id, input)
          await loadAll('redeemCodes')
          showToast('兑换码已更新', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '兑换码更新失败', 'error')
        }
      },
    })
  }

  async function deleteRedeemCode(id: string) {
    confirmAdminAction({
      title: '删除兑换码',
      message: '确认删除该兑换码？如果已有用户兑换，系统会改为停用以保留历史。',
      confirmText: '删除',
      action: async () => {
        try {
          await platformApi.deleteAdminRedeemCode(id)
          closeEditor()
          await loadAll('redeemCodes')
          showToast('兑换码已删除或停用', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '兑换码删除失败', 'error')
        }
      },
    })
  }

  async function patchCreditPackage(id: string, input: Partial<CreditPackageDraft>) {
    confirmAdminAction({
      title: '修改积分套餐',
      message: '确认修改该积分套餐？前台下单入口会按新配置展示。',
      confirmText: '确认修改',
      action: async () => {
        try {
          await platformApi.updateAdminCreditPackage(id, input)
          await loadAll('billing')
          showToast('积分套餐已更新', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '积分套餐更新失败', 'error')
        }
      },
    })
  }

  async function deleteCreditPackage(id: string) {
    confirmAdminAction({
      title: '删除积分套餐',
      message: '确认删除该套餐？如果已有订单，系统会改为下架以保留历史。',
      confirmText: '删除',
      action: async () => {
        try {
          await platformApi.deleteAdminCreditPackage(id)
          closeEditor()
          await loadAll('billing')
          showToast('积分套餐已删除或下架', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '积分套餐删除失败', 'error')
        }
      },
    })
  }

  async function patchCreditOrder(id: string, input: { status: 'paid' | 'cancelled'; adminNote?: string }) {
    const label = input.status === 'paid' ? '确认该订单到账并给用户加积分？' : '确认取消该订单？'
    confirmAdminAction({
      title: input.status === 'paid' ? '确认订单到账' : '取消订单',
      message: label,
      confirmText: input.status === 'paid' ? '确认到账' : '取消订单',
      action: async () => {
        try {
          await platformApi.updateAdminCreditOrder(id, input)
          await Promise.all([loadAll('billing'), loadAll('credits')])
          showToast(input.status === 'paid' ? '订单已确认，积分已到账' : '订单已取消', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '订单处理失败', 'error')
        }
      },
    })
  }

  async function patchSupportTicket(id: string, input: Partial<Pick<SupportTicket, 'status' | 'priority' | 'adminReply' | 'adminNote'>>) {
    confirmAdminAction({
      title: '修改工单',
      message: '确认保存该工单处理结果？用户可能会看到管理员回复。',
      confirmText: '确认修改',
      action: async () => {
        try {
          await platformApi.updateAdminSupportTicket(id, input)
          await loadAll('tickets')
          showToast('工单已更新', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '工单更新失败', 'error')
        }
      },
    })
  }

  async function patchModerationRule(id: string, input: Partial<ModerationRuleDraft>) {
    confirmAdminAction({
      title: '修改风控规则',
      message: '确认修改该风控规则？启用规则会影响生成前校验。',
      confirmText: '确认修改',
      action: async () => {
        try {
          await platformApi.updateAdminModerationRule(id, input)
          await loadAll('moderation')
          showToast('风控规则已更新', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '风控规则更新失败', 'error')
        }
      },
    })
  }

  async function deleteModerationRule(id: string) {
    confirmAdminAction({
      title: '删除风控规则',
      message: '确认删除该风控规则？删除后将不再参与生成前校验。',
      confirmText: '删除',
      action: async () => {
        try {
          await platformApi.deleteAdminModerationRule(id)
          closeEditor()
          await loadAll('moderation')
          showToast('风控规则已删除', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '风控规则删除失败', 'error')
        }
      },
    })
  }

  function toggleAnnouncementSelection(id: string) {
    setSelectedAnnouncementIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
  }

  function toggleCurrentPageAnnouncements(checked: boolean) {
    setSelectedAnnouncementIds(checked ? filteredAnnouncements.map((item) => item.id) : [])
  }

  async function batchPatchAnnouncements(input: Partial<Pick<AdminAnnouncement, 'status' | 'pinned'>>) {
    if (!selectedAnnouncementIds.length) return
    confirmAdminAction({
      title: '批量修改公告',
      message: `确认批量修改选中的 ${selectedAnnouncementIds.length} 条公告？`,
      confirmText: '批量修改',
      action: async () => {
        setAnnouncementBatchOperating(true)
        try {
          await Promise.all(selectedAnnouncementIds.map((id) => platformApi.updateAdminAnnouncement(id, input)))
          await loadAll('announcements')
          showToast(`已更新 ${selectedAnnouncementIds.length} 条公告`, 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '公告批量更新失败', 'error')
        } finally {
          setAnnouncementBatchOperating(false)
        }
      },
    })
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault()
    try {
      const parsedHeroSlides = JSON.parse(settingsDraft.landingHeroSlidesJson) as unknown
      if (!Array.isArray(parsedHeroSlides)) {
        showToast('首页轮播图配置必须是 JSON 数组', 'error')
        return
      }
    } catch {
      showToast('首页轮播图配置不是有效 JSON，请检查后再保存', 'error')
      return
    }
    confirmAdminAction({
      title: '保存平台设置',
      message: '确认保存平台级设置？这些配置会影响注册赠送、生成策略和运营规则。',
      confirmText: '保存设置',
      action: async () => {
        try {
          const result = await platformApi.updateAdminSettings(settingsDraft)
          setSettingsDraft(result.settings)
          showToast('平台设置已保存', 'success')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '平台设置保存失败', 'error')
        }
      },
    })
  }

  async function exportUsers() {
    try {
      const result = await platformApi.listAdminUsers({
        q: query,
        role: userRoleFilter,
        status: userStatusFilter,
        segment: userSegmentFilter,
        page: 1,
        pageSize: 1000,
      })
      downloadCsv(`users-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['ID', '邮箱', '角色', '状态', '分层', '备注', '积分余额', '任务数', '流水数', '登录次数', '最后登录', '注册时间'],
        ...result.items.map((user) => [
          user.id,
          user.email,
          user.role === 'admin' ? '管理员' : '用户',
          user.status === 'active' ? '正常' : '禁用',
          userSegmentLabel(user.segment),
          user.adminNote,
          user.creditBalance,
          user._count?.tasks ?? 0,
          user._count?.ledgers ?? 0,
          user.loginCount,
          formatTime(user.lastLoginAt),
          formatTime(user.createdAt),
        ]),
      ])
      showToast(`已导出 ${result.items.length} 个用户`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '用户导出失败', 'error')
    }
  }

  async function exportCreditLedgers() {
    try {
      const result = await platformApi.listAdminCreditLedger({
        q: ledgerQuery,
        type: ledgerType,
        from: ledgerFrom ? `${ledgerFrom}T00:00:00.000` : undefined,
        to: ledgerTo ? `${ledgerTo}T23:59:59.999` : undefined,
        page: 1,
        pageSize: 1000,
      })
      downloadCsv(`credit-ledger-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['ID', '用户', '变化', '余额快照', '原因', '任务 ID', '时间'],
        ...result.items.map((item) => [
          item.id,
          item.user?.email ?? item.userId,
          item.delta,
          item.balanceAfter,
          item.reason,
          item.taskId ?? '',
          formatTime(item.createdAt),
        ]),
      ])
      showToast(`已导出 ${result.items.length} 条积分流水`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '积分流水导出失败', 'error')
    }
  }

  async function exportUsageReport() {
    try {
      const report = usageReport ?? await platformApi.getAdminUsageReport({
        from: reportFrom ? `${reportFrom}T00:00:00.000` : undefined,
        to: reportTo ? `${reportTo}T23:59:59.999` : undefined,
      })
      downloadCsv(`usage-report-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['分组', '名称', '任务数', '积分消耗', '附加信息'],
        ['汇总', '总任务', report.summary.totalTasks, report.summary.credits, `成功率 ${report.summary.successRate}% / 失败率 ${report.summary.errorRate}%`],
        ...report.modelUsage.map((item) => [
          '模型',
          item.displayName,
          item.tasks,
          item.credits,
          `${item.name} / ${item.upstreamProviderName} / ${item.upstreamModel}`,
        ]),
        ...report.providerUsage.map((item) => [
          '上游',
          item.name,
          item.tasks,
          item.credits,
          `${item.baseUrl} / 健康 ${item.health} / 绑定模型 ${item.models}`,
        ]),
        ...report.userUsage.map((item) => [
          '用户',
          item.email,
          item.tasks,
          item.credits,
          `${userSegmentLabel(item.segment as AdminUserSummary['segment'])} / ${item.status === 'active' ? '正常' : '禁用'}`,
        ]),
      ])
      showToast('用量报表已导出', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '用量报表导出失败', 'error')
    }
  }

  async function exportAuditLogs() {
    try {
      const result = await platformApi.listAdminAuditLogs({
        q: auditQuery,
        action: auditAction,
        from: auditFrom ? `${auditFrom}T00:00:00.000` : undefined,
        to: auditTo ? `${auditTo}T23:59:59.999` : undefined,
        page: 1,
        pageSize: 1000,
      })
      const rows = [
        ['ID', '动作', '目标', '操作者', 'IP', '时间', '详情'],
        ...result.items.map((item) => [
          item.id,
          item.action,
          item.target,
          item.actor?.email ?? item.actorId ?? '',
          item.ip ?? '',
          formatTime(item.createdAt),
          formatJson(item.detail),
        ]),
      ]
      downloadCsv(`audit-logs-${new Date().toISOString().slice(0, 10)}.csv`, rows)
      showToast(`已导出 ${result.items.length} 条审计日志`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '审计日志导出失败', 'error')
    }
  }

  async function exportLoginLogs() {
    try {
      const result = await platformApi.listAdminLoginLogs({
        q: loginLogQuery,
        success: loginLogSuccess,
        from: loginLogFrom ? `${loginLogFrom}T00:00:00.000` : undefined,
        to: loginLogTo ? `${loginLogTo}T23:59:59.999` : undefined,
        page: 1,
        pageSize: 1000,
      })
      downloadCsv(`login-logs-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['ID', '邮箱', '用户ID', '结果', '原因', 'IP', 'User-Agent', '时间'],
        ...result.items.map((item) => [
          item.id,
          item.email,
          item.userId ?? '',
          item.success ? '成功' : '失败',
          loginReasonLabel(item.reason),
          item.ip ?? '',
          item.userAgent ?? '',
          formatTime(item.createdAt),
        ]),
      ])
      showToast(`已导出 ${result.items.length} 条登录日志`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '登录日志导出失败', 'error')
    }
  }

  function renderOverview() {
    const stats = overview?.stats
    const workbench = overview?.workbench
    const squarePendingCount = overviewSquareUsage?.shares.pendingReview ?? overviewSquarePendingShares.length
    const squareReportCount = overviewSquarePendingShares.reduce((sum, item) => sum + item.reportCount, 0)
    const modelMax = Math.max(...(overview?.modelUsage ?? []).map((item) => item.tasks), 1)
    const providerMax = Math.max(...(overview?.providerSummaries ?? []).map((item) => item._count?.models ?? 0), 1)
    const todoItems = [
      {
        key: 'orders',
        label: '待确认订单',
        value: workbench?.pendingOrders ?? 0,
        hint: '人工确认充值到账',
        tone: 'amber' as const,
        action: () => jumpToBilling(),
      },
      {
        key: 'tickets',
        label: '待处理工单',
        value: workbench?.openTickets ?? 0,
        hint: '客服问题和投诉',
        tone: 'red' as const,
        action: () => jumpToTickets('', 'open'),
      },
      {
        key: 'failures',
        label: '24h 失败任务',
        value: workbench?.failedTasks24h ?? 0,
        hint: '上游异常或参数失败',
        tone: 'red' as const,
        action: () => jumpToTasks(),
      },
      {
        key: 'upstreams',
        label: '异常上游',
        value: workbench?.unhealthyProviders ?? 0,
        hint: '禁用或健康检查失败',
        tone: 'amber' as const,
        action: () => jumpToUpstream(),
      },
      {
        key: 'square',
        label: '广场待审核',
        value: squarePendingCount,
        hint: `${squareReportCount} 次举报待处理`,
        tone: 'amber' as const,
        action: () => jumpToSquare(),
      },
      {
        key: 'risk',
        label: '风险用户',
        value: workbench?.riskyUsers ?? 0,
        hint: '禁用或风险分层',
        tone: 'blue' as const,
        action: () => jumpToUsers('', 'all', 'risk'),
      },
      {
        key: 'moderation',
        label: '启用风控',
        value: workbench?.activeModerationRules ?? 0,
        hint: '提示词拦截规则',
        tone: 'green' as const,
        action: () => {
          setModerationEnabledFilter('enabled')
          setTab('moderation')
        },
      },
    ]
    return (
      <SectionShell title="运营总览" description="先看系统健康、增长趋势、模型消耗和上游配置，再进入具体模块处理问题。">
        <div className="grid gap-3 md:grid-cols-4">
          <StatCard label="用户数" value={stats?.users ?? '-'} hint={`${stats?.disabledUsers ?? 0} 个已禁用`} />
          <StatCard label="近 7 天任务" value={stats?.tasks7d ?? '-'} hint={`${stats?.failedTasks7d ?? 0} 个失败`} />
          <StatCard label="近 7 天积分流转" value={`${stats?.creditsIncome7d ?? '-'} / ${stats?.creditsConsumed7d ?? '-'}`} hint="收入 / 消耗" />
          <StatCard label="可用模型 / 上游" value={`${stats?.enabledModels ?? '-'} / ${stats?.enabledProviders ?? '-'}`} hint={`${stats?.runningTasks ?? 0} 个任务运行中`} />
        </div>

        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">待办中心</div>
              <div className="mt-1 text-xs text-gray-400">聚合订单、工单、失败任务、异常上游和风险项，先处理会影响用户体验的事项。</div>
            </div>
            <button type="button" onClick={() => void loadAll('overview')} className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">刷新待办</button>
          </div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
            {todoItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.action}
                className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-gray-200 hover:bg-white hover:shadow-sm dark:border-white/[0.06] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-500">{item.label}</span>
                  <StatusBadge tone={item.tone}>{item.value}</StatusBadge>
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">{item.value}</div>
                <div className="mt-1 text-xs text-gray-400">{item.hint}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-4">
            <div className="rounded-2xl border border-gray-100 p-3 dark:border-white/[0.06]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">待确认订单</div>
                <button type="button" onClick={() => jumpToBilling()} className="text-xs font-medium text-blue-600 hover:text-blue-700">处理</button>
              </div>
              <div className="space-y-2">
                {workbench?.recentPendingOrders?.map((order) => (
                  <button key={order.id} type="button" onClick={() => jumpToBilling(order.orderNo, 'pending')} className="w-full rounded-xl bg-gray-50 px-3 py-2 text-left text-sm transition hover:bg-white hover:shadow-sm dark:bg-white/[0.04] dark:hover:bg-white/[0.07]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-900 dark:text-gray-100">{order.user?.email ?? order.userId}</div>
                        <div className="mt-0.5 truncate text-xs text-gray-400">{order.orderNo} · {order.packageName} · {formatPrice(order.priceCents, order.currency)}</div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-amber-700">直达</span>
                    </div>
                  </button>
                ))}
                {overview && !workbench?.recentPendingOrders?.length && <EmptyState text="暂无待确认订单" />}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 p-3 dark:border-white/[0.06]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">待处理工单</div>
                <button type="button" onClick={() => jumpToTickets('', 'open')} className="text-xs font-medium text-blue-600 hover:text-blue-700">处理</button>
              </div>
              <div className="space-y-2">
                {workbench?.recentOpenTickets?.map((ticket) => (
                  <button key={ticket.id} type="button" onClick={() => jumpToTickets(ticket.title, ticket.status, ticket.priority)} className="w-full rounded-xl bg-gray-50 px-3 py-2 text-left text-sm transition hover:bg-white hover:shadow-sm dark:bg-white/[0.04] dark:hover:bg-white/[0.07]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-900 dark:text-gray-100">{ticket.title}</div>
                        <div className="mt-0.5 truncate text-xs text-gray-400">{ticket.user?.email ?? ticket.userId} · {ticketCategoryLabel(ticket.category)}</div>
                      </div>
                      <StatusBadge tone={ticket.priority === 'urgent' || ticket.priority === 'high' ? 'red' : 'amber'}>{ticketPriorityLabel(ticket.priority)}</StatusBadge>
                    </div>
                  </button>
                ))}
                {overview && !workbench?.recentOpenTickets?.length && <EmptyState text="暂无待处理工单" />}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 p-3 dark:border-white/[0.06]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">异常上游</div>
                <button type="button" onClick={() => jumpToUpstream()} className="text-xs font-medium text-blue-600 hover:text-blue-700">检查</button>
              </div>
              <div className="space-y-2">
                {workbench?.recentUnhealthyProviders?.map((provider) => (
                  <button key={provider.id} type="button" onClick={() => jumpToUpstream(provider)} className="w-full rounded-xl bg-gray-50 px-3 py-2 text-left text-sm transition hover:bg-white hover:shadow-sm dark:bg-white/[0.04] dark:hover:bg-white/[0.07]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-900 dark:text-gray-100">{provider.name}</div>
                        <div className="mt-0.5 truncate text-xs text-gray-400" title={provider.lastHealthMessage}>{provider.lastHealthMessage || provider.baseUrl}</div>
                      </div>
                      <StatusBadge tone={provider.enabled ? upstreamHealthTone(provider.lastHealthStatus) : 'gray'}>{provider.enabled ? upstreamHealthLabel(provider.lastHealthStatus) : '停用'}</StatusBadge>
                    </div>
                  </button>
                ))}
                {overview && !workbench?.recentUnhealthyProviders?.length && <EmptyState text="暂无异常上游" />}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 p-3 dark:border-white/[0.06]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">广场待审核</div>
                <button
                  type="button"
                  onClick={() => jumpToSquare()}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  审核
                </button>
              </div>
              <div className="space-y-2">
                {overviewSquarePendingShares.map((share) => (
                  <button key={share.id} type="button" onClick={() => jumpToSquare(share.title || share.prompt || share.id, 'pending_review')} className="w-full rounded-xl bg-gray-50 px-3 py-2 text-left text-sm transition hover:bg-white hover:shadow-sm dark:bg-white/[0.04] dark:hover:bg-white/[0.07]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-900 dark:text-gray-100">{share.title || '未命名分享'}</div>
                        <div className="mt-0.5 truncate text-xs text-gray-400">{share.kind} · {new Date(share.updatedAt).toLocaleString()}</div>
                      </div>
                      <StatusBadge tone={share.reportCount > 0 ? 'red' : 'amber'}>{share.reportCount > 0 ? `举报 ${share.reportCount}` : '待审'}</StatusBadge>
                    </div>
                  </button>
                ))}
                {overview && !overviewSquarePendingShares.length && <EmptyState text={overviewSquareUsage ? '暂无待审核广场内容' : '广场后台未配置'} />}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">7 天运营趋势</div>
                <div className="mt-1 text-xs text-gray-400">蓝色为生成任务，黄色为积分流转；下面附带新增用户和失败任务。</div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-blue-500" />任务</span>
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-500" />积分</span>
              </div>
            </div>
            {overview?.trend?.length ? <TrendGrid items={overview.trend} /> : <EmptyState text="暂无趋势数据" />}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">模型消耗排行</div>
            <div className="space-y-4">
              {overview?.modelUsage?.map((item) => (
                <ProgressRow
                  key={item.modelConfigId}
                  label={item.displayName}
                  value={item.tasks}
                  max={modelMax}
                  meta={`${item.tasks} 次 · ${item.credits} 分`}
                  tone={item.enabled ? 'blue' : 'amber'}
                />
              ))}
              {overview && !overview.modelUsage.length && <EmptyState text="近 7 天暂无模型调用" />}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">上游渠道摘要</div>
              <button onClick={() => setTab('upstreams')} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">管理渠道</button>
            </div>
            <div className="space-y-4">
              {overview?.providerSummaries?.map((provider) => (
                <ProgressRow
                  key={provider.id}
                  label={provider.name}
                  value={provider._count?.models ?? 0}
                  max={providerMax}
                  meta={`${provider._count?.models ?? 0} 模型 · P${provider.priority}`}
                  tone={provider.enabled ? 'green' : 'red'}
                />
              ))}
              {overview && !overview.providerSummaries.length && <EmptyState text="暂无上游渠道" />}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">最新用户</div>
              <button onClick={() => setTab('users')} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">查看用户</button>
            </div>
            <div className="space-y-2">
              {overview?.recentUsers?.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-white/[0.04]">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-gray-900 dark:text-gray-100">{user.email}</div>
                    <div className="mt-0.5 text-xs text-gray-400">{formatTime(user.createdAt)} · 任务 {user._count?.tasks ?? 0}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge tone={user.status === 'active' ? 'green' : 'red'}>{user.status === 'active' ? '正常' : '禁用'}</StatusBadge>
                    <span className="text-xs font-semibold text-amber-700">{user.creditBalance}</span>
                  </div>
                </div>
              ))}
              {overview && !overview.recentUsers.length && <EmptyState text="暂无用户" />}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">最近生成</div>
            <button onClick={() => setTab('tasks')} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">查看日志</button>
          </div>
          <div className="space-y-2">
            {overview?.recentTasks?.map((task) => (
              <div key={task.id} className="grid gap-3 rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-white/[0.04] md:grid-cols-[minmax(0,1fr)_120px_90px] md:items-center">
                <div className="min-w-0">
                  <div className="truncate text-gray-800 dark:text-gray-100">{task.prompt}</div>
                  <div className="mt-0.5 text-xs text-gray-400">{task.user?.email} · {task.modelConfig?.displayName}</div>
                </div>
                <span className="text-xs text-gray-400">{formatTime(task.createdAt)}</span>
                <StatusBadge tone={taskTone(task.status)}>{task.status}</StatusBadge>
              </div>
            ))}
            {overview && !overview.recentTasks.length && <EmptyState text="暂无生成任务" />}
          </div>
        </div>
      </SectionShell>
    )
  }

  function renderReports() {
    const report = usageReport
    const maxTrend = Math.max(...(report?.trend ?? []).map((item) => Math.max(item.tasks, item.credits)), 1)
    const maxModelTasks = Math.max(...(report?.modelUsage ?? []).map((item) => item.tasks), 1)
    const maxProviderTasks = Math.max(...(report?.providerUsage ?? []).map((item) => item.tasks), 1)
    const maxUserTasks = Math.max(...(report?.userUsage ?? []).map((item) => item.tasks), 1)

    return (
      <SectionShell
        title="数据报表"
        description="按时间段查看生成量、成功率、积分消耗、模型排行、上游渠道和高频用户。"
        action={
          <div className="grid w-full gap-2 md:grid-cols-[140px_140px_auto_auto] xl:w-auto">
            <input
              type="date"
              value={reportFrom}
              onChange={(event) => setReportFrom(event.target.value)}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
              aria-label="报表开始日期"
            />
            <input
              type="date"
              value={reportTo}
              onChange={(event) => setReportTo(event.target.value)}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
              aria-label="报表结束日期"
            />
            <button type="button" onClick={() => void loadAll('reports')} className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]">刷新报表</button>
            <button type="button" onClick={() => void exportUsageReport()} className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-gray-950">导出报表</button>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-4">
          <StatCard label="生成任务" value={report?.summary.totalTasks ?? '-'} hint={`${report?.summary.doneTasks ?? 0} 成功 / ${report?.summary.errorTasks ?? 0} 失败`} />
          <StatCard label="成功率" value={report ? `${report.summary.successRate}%` : '-'} hint={`失败率 ${report?.summary.errorRate ?? 0}%`} />
          <StatCard label="积分消耗" value={report?.summary.credits ?? '-'} hint="按任务成本快照统计" />
          <StatCard label="活跃用户" value={report?.summary.activeUsers ?? '-'} hint={`${report?.summary.runningTasks ?? 0} 个任务运行中`} />
        </div>

        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">用量趋势</div>
              <div className="mt-1 text-xs text-gray-400">蓝色为任务量，黄色为积分消耗；用于判断活动、投放和渠道波动。</div>
            </div>
            <div className="text-xs text-gray-400">{report ? `${formatTime(report.range.from)} 至 ${formatTime(report.range.to)}` : '等待加载'}</div>
          </div>
          <div className="grid gap-2 md:grid-cols-7 xl:grid-cols-10">
            {report?.trend.map((item) => (
              <div key={item.date} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 dark:border-white/[0.06] dark:bg-white/[0.04]">
                <div className="text-xs font-medium text-gray-500">{item.date.slice(5)}</div>
                <div className="mt-3 flex h-20 items-end gap-1.5">
                  <div className="w-2 rounded-t bg-blue-500" style={{ height: `${Math.max(3, (item.tasks / maxTrend) * 76)}px` }} />
                  <div className="w-2 rounded-t bg-amber-500" style={{ height: `${Math.max(3, (item.credits / maxTrend) * 76)}px` }} />
                </div>
                <div className="mt-3 space-y-1 text-xs text-gray-500">
                  <div className="flex justify-between"><span>任务</span><span>{item.tasks}</span></div>
                  <div className="flex justify-between"><span>积分</span><span>{item.credits}</span></div>
                  <div className="flex justify-between"><span>失败</span><span>{item.error}</span></div>
                </div>
              </div>
            ))}
            {report && !report.trend.length && <EmptyState text="暂无趋势数据" />}
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="border-b border-gray-100 px-4 py-3 dark:border-white/[0.06]">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">模型用量排行</div>
              <div className="mt-1 text-xs text-gray-400">用于调整模型价格、默认模型和上游绑定。</div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[780px]">
                <div className="grid grid-cols-[1.25fr_1.1fr_90px_90px_120px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-white/[0.04]">
                  <span>模型</span>
                  <span>上游</span>
                  <span>任务</span>
                  <span>积分</span>
                  <span>状态</span>
                </div>
                {report?.modelUsage.map((item) => (
                  <div key={item.modelConfigId} className="grid grid-cols-[1.25fr_1.1fr_90px_90px_120px] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm last:border-0 dark:border-white/[0.06]">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{item.displayName}</div>
                      <div className="mt-1 truncate text-xs text-gray-400">{item.name} · {item.upstreamModel}</div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(3, (item.tasks / maxModelTasks) * 100)}%` }} /></div>
                    </div>
                    <div className="truncate text-xs text-gray-500">{item.upstreamProviderName}</div>
                    <div className="font-semibold">{item.tasks}</div>
                    <div className="font-semibold text-amber-700">{item.credits}</div>
                    <StatusBadge tone={item.enabled ? 'green' : 'gray'}>{item.enabled ? '启用' : '停用'}</StatusBadge>
                  </div>
                ))}
                {report && !report.modelUsage.length && <EmptyState text="当前时间段暂无模型调用" />}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="border-b border-gray-100 px-4 py-3 dark:border-white/[0.06]">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">上游渠道用量</div>
              <div className="mt-1 text-xs text-gray-400">看清楚请求实际转发到哪里，以及渠道健康和消耗。</div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
              {report?.providerUsage.map((item) => (
                <div key={item.providerId ?? 'default'} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{item.name}</div>
                      <div className="mt-1 truncate text-xs text-gray-400">{item.baseUrl}</div>
                    </div>
                    <StatusBadge tone={upstreamHealthTone(item.health as AdminUpstreamProvider['lastHealthStatus'])}>{upstreamHealthLabel(item.health as AdminUpstreamProvider['lastHealthStatus'])}</StatusBadge>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(3, (item.tasks / maxProviderTasks) * 100)}%` }} /></div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-white/[0.04]"><div className="font-semibold">{item.tasks}</div><div className="text-gray-400">任务</div></div>
                    <div className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-white/[0.04]"><div className="font-semibold">{item.credits}</div><div className="text-gray-400">积分</div></div>
                    <div className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-white/[0.04]"><div className="font-semibold">{item.models}</div><div className="text-gray-400">模型</div></div>
                  </div>
                </div>
              ))}
              {report && !report.providerUsage.length && <EmptyState text="当前时间段暂无渠道调用" />}
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-white/[0.06]">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">高频用户</div>
            <div className="mt-1 text-xs text-gray-400">辅助识别核心用户、活动用户和异常消耗用户。</div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1.4fr_110px_110px_110px_1fr] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-white/[0.04]">
                <span>用户</span>
                <span>分层</span>
                <span>任务</span>
                <span>积分</span>
                <span>占比</span>
              </div>
              {report?.userUsage.map((item) => (
                <div key={item.userId} className="grid grid-cols-[1.4fr_110px_110px_110px_1fr] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm last:border-0 dark:border-white/[0.06]">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{item.email}</div>
                    <div className="mt-1 truncate text-xs text-gray-400">ID {item.userId.slice(0, 12)}</div>
                  </div>
                  <StatusBadge tone={userSegmentTone(item.segment as AdminUserSummary['segment'])}>{userSegmentLabel(item.segment as AdminUserSummary['segment'])}</StatusBadge>
                  <div className="font-semibold">{item.tasks}</div>
                  <div className="font-semibold text-amber-700">{item.credits}</div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]"><div className="h-full rounded-full bg-slate-900 dark:bg-white" style={{ width: `${Math.max(3, (item.tasks / maxUserTasks) * 100)}%` }} /></div>
                </div>
              ))}
              {report && !report.userUsage.length && <EmptyState text="当前时间段暂无用户调用" />}
            </div>
          </div>
        </div>
      </SectionShell>
    )
  }

  function renderCredits() {
    const incomeCount = creditLedgers.filter((ledger) => ledger.delta > 0).length
    const expenseCount = creditLedgers.filter((ledger) => ledger.delta < 0).length
    const totalDelta = creditLedgers.reduce((sum, ledger) => sum + ledger.delta, 0)

    return (
      <SectionShell
        title="积分流水"
        description="集中查看注册送分、生成扣费、失败退回和人工调整，方便运营对账和客服排查。"
        action={
          <div className="grid w-full gap-2 md:grid-cols-[minmax(220px,1fr)_130px_140px_140px_auto] xl:w-auto">
            <input
              value={ledgerQuery}
              onChange={(event) => setLedgerQuery(event.target.value)}
              placeholder="搜索用户、原因、任务 ID"
              className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
            />
            <select
              value={ledgerType}
              onChange={(event) => setLedgerType(event.target.value)}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
            >
              <option value="all">全部流水</option>
              <option value="income">收入</option>
              <option value="expense">支出</option>
            </select>
            <input
              type="date"
              value={ledgerFrom}
              onChange={(event) => setLedgerFrom(event.target.value)}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
              aria-label="积分流水开始日期"
            />
            <input
              type="date"
              value={ledgerTo}
              onChange={(event) => setLedgerTo(event.target.value)}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
              aria-label="积分流水结束日期"
            />
            <button
              type="button"
              onClick={() => void exportCreditLedgers()}
              className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-gray-950"
            >
              导出流水
            </button>
          </div>
        }
      >
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <StatCard label="当前列表净变化" value={totalDelta > 0 ? `+${totalDelta}` : totalDelta} hint="受当前筛选条件影响" />
          <StatCard label="收入流水" value={incomeCount} hint="注册赠送、退回、人工补发" />
          <StatCard label="支出流水" value={expenseCount} hint="生成扣费、人工扣减" />
        </div>

        <AdminTableShell
          mobileHint="横向滑动查看更多流水字段和操作"
          footer={<PaginationBar page={ledgerPage} pageSize={adminPageSize} total={ledgerTotal} onPageChange={setLedgerPage} />}
        >
          <div className="min-w-[980px]">
              <div className="sticky top-0 z-20 grid grid-cols-[1.15fr_1.4fr_110px_110px_150px_110px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-[#171a22]">
                <span>用户</span>
                <span>原因</span>
                <span>变化</span>
                <span>余额</span>
                <span>时间</span>
                <span className="text-right">操作</span>
              </div>
              {creditLedgers.map((ledger) => (
                <div key={ledger.id} className="grid grid-cols-[1.15fr_1.4fr_110px_110px_150px_110px] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm transition last:border-0 hover:bg-gray-50 dark:border-white/[0.06] dark:hover:bg-white/[0.04]">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{ledger.user?.email ?? ledger.userId}</div>
                    <div className="mt-1 truncate text-xs text-gray-400">ID {ledger.id.slice(0, 12)}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-gray-700 dark:text-gray-200">{ledger.reason}</div>
                    {ledger.taskId && <div className="mt-1 truncate text-xs text-gray-400">任务 {ledger.taskId.slice(0, 12)}</div>}
                  </div>
                  <StatusBadge tone={ledger.delta > 0 ? 'green' : ledger.delta < 0 ? 'red' : 'gray'}>
                    {ledger.delta > 0 ? '+' : ''}{ledger.delta}
                  </StatusBadge>
                  <div className="font-semibold text-amber-700">{ledger.balanceAfter}</div>
                  <div className="text-xs text-gray-400">{formatTime(ledger.createdAt)}</div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setSelectedLedgerId(ledger.id)} className="h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">详情</button>
                  </div>
                </div>
              ))}
              {!creditLedgers.length && <EmptyState text="暂无匹配的积分流水" />}
          </div>
        </AdminTableShell>
      </SectionShell>
    )
  }

  function renderTasks() {
    return (
      <SectionShell
        title="生成日志"
        description="运营和排障入口。失败任务优先看错误、用户、模型和消耗。"
        action={
          <div className="grid w-full gap-2 md:grid-cols-[minmax(220px,1.2fr)_150px_minmax(180px,1fr)_140px_140px_auto] xl:w-auto">
            <input
              value={taskQuery}
              onChange={(event) => setTaskQuery(event.target.value)}
              placeholder="搜索任务、提示词、用户、模型"
              className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
            />
            <select value={taskStatus} onChange={(event) => setTaskStatus(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <option value="all">全部状态</option>
              <option value="done">成功</option>
              <option value="error">失败</option>
              <option value="running">运行中</option>
            </select>
            <select value={taskModelFilter} onChange={(event) => setTaskModelFilter(event.target.value)} className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <option value="all">全部模型</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>{model.displayName}</option>
              ))}
            </select>
            <input
              type="date"
              value={taskFrom}
              onChange={(event) => setTaskFrom(event.target.value)}
              aria-label="开始日期"
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
            />
            <input
              type="date"
              value={taskTo}
              onChange={(event) => setTaskTo(event.target.value)}
              aria-label="结束日期"
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
            />
            <button
              type="button"
              onClick={() => {
                setTaskQuery('')
                setTaskStatus('all')
                setTaskModelFilter('all')
                setTaskFrom('')
                setTaskTo('')
              }}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.08]"
            >
              重置
            </button>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span>
            当前显示 <span className="font-semibold text-gray-900 dark:text-gray-100">{tasks.length}</span> / {tasksTotal} 条日志
          </span>
          {(taskQuery || taskStatus !== 'all' || taskModelFilter !== 'all' || taskFrom || taskTo) && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">已应用筛选</span>
          )}
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center gap-2 text-gray-500">
            <span>已选 <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedTaskIds.length}</span> / 本页 {tasks.length}</span>
            <span className="hidden h-3 w-px bg-gray-200 dark:bg-white/[0.08] sm:block" />
            <span>清理日志只删除后台任务记录，不影响积分流水。</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!selectedTaskIds.length || taskBatchOperating}
              onClick={() => void batchDeleteTasks()}
              className="h-8 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-rose-400/20 dark:hover:bg-rose-400/10"
            >
              批量清理
            </button>
            <button
              type="button"
              disabled={!selectedTaskIds.length || taskBatchOperating}
              onClick={() => setSelectedTaskIds([])}
              className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]"
            >
              取消选择
            </button>
          </div>
        </div>
        <AdminTableShell
          mobileHint="横向滑动查看更多任务字段和操作"
          footer={<PaginationBar page={tasksPage} pageSize={adminPageSize} total={tasksTotal} onPageChange={setTasksPage} />}
        >
          <div className="min-w-[1500px]">
              <div className="sticky top-0 z-20 grid grid-cols-[34px_1.45fr_170px_1.05fr_1fr_180px_110px_90px_150px_170px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-[#171a22]">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={tasks.length > 0 && selectedTaskIds.length === tasks.length}
                    onChange={(event) => toggleCurrentPageTasks(event.target.checked)}
                    aria-label="选择当前页全部生成日志"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
                <span>请求</span>
                <span>类型 / 参考图</span>
                <span>用户</span>
                <span>模型</span>
                <span>参数</span>
                <span>状态</span>
                <span>消耗</span>
                <span>创建时间</span>
                <span className="text-right">操作</span>
              </div>
              {tasks.map((task) => {
                const checked = selectedTaskIds.includes(task.id)
                const operation = taskOperationMeta(task)
                const referenceImages = taskReferenceImages(task)
                return (
                  <div key={task.id} className={cx('grid grid-cols-[34px_1.45fr_170px_1.05fr_1fr_180px_110px_90px_150px_170px] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm transition last:border-0 dark:border-white/[0.06]', checked ? 'bg-blue-50/70 dark:bg-blue-400/10' : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]')}>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTaskSelection(task.id)}
                        aria-label={`选择生成日志 ${task.id}`}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-gray-900 dark:text-gray-100">{task.prompt}</div>
                      <div className="mt-1 truncate text-xs text-gray-400">
                        ID {task.id.slice(0, 12)} · 云端资产 {task.generatedAssets?.length ?? 0}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusBadge tone={operation.tone}>{operation.label}</StatusBadge>
                        {operation.isEdit && (
                          <span className="text-xs text-gray-400">{referenceImages.length} 张参考图</span>
                        )}
                      </div>
                      {operation.isEdit && (
                        <div className="mt-1.5 flex min-h-9 items-center gap-1.5">
                          {referenceImages.length ? referenceImages.slice(0, 4).map((image, index) => {
                            const previewDataUrl = typeof image.previewDataUrl === 'string' ? image.previewDataUrl : ''
                            const title = [
                              typeof image.id === 'string' ? `ID ${image.id}` : '',
                              typeof image.mimeType === 'string' ? image.mimeType : '',
                              typeof image.byteSize === 'number' ? `${Math.round(image.byteSize / 1024)}KB` : '',
                            ].filter(Boolean).join(' · ')
                            return previewDataUrl ? (
                              <img
                                key={`${task.id}-ref-${index}`}
                                src={previewDataUrl}
                                title={title || '参考图'}
                                className="h-8 w-8 rounded-lg border border-gray-200 object-cover shadow-sm dark:border-white/[0.08]"
                                alt="参考图"
                              />
                            ) : (
                              <span
                                key={`${task.id}-ref-${index}`}
                                title={title || '参考图无预览'}
                                className="grid h-8 w-8 place-items-center rounded-lg border border-dashed border-gray-200 text-[10px] text-gray-400 dark:border-white/[0.08]"
                              >
                                图
                              </span>
                            )
                          }) : (
                            <span className="text-xs text-gray-400">无预览</span>
                          )}
                          {referenceImages.length > 4 && <span className="text-xs text-gray-400">+{referenceImages.length - 4}</span>}
                        </div>
                      )}
                    </div>
                    <span className="truncate text-xs text-gray-500">{task.user?.email ?? '-'}</span>
                    <span className="truncate text-xs text-gray-500">{task.modelConfig?.displayName ?? '-'}</span>
                    <span className="truncate text-xs text-gray-500">{taskParamsSummary(task.params)}</span>
                    <StatusBadge tone={taskTone(task.status)}>{task.status}</StatusBadge>
                    <div className="font-semibold text-amber-700">{task.costCredits}</div>
                    <span className="text-xs text-gray-400">{formatTime(task.createdAt)}</span>
                    <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => setSelectedTaskId(task.id)} className="h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">详情</button>
                      <button
                        type="button"
                        disabled={task.status === 'running'}
                        onClick={() => void deleteTask(task.id)}
                        className="h-8 rounded-lg border border-rose-200 px-2.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-rose-400/20 dark:hover:bg-rose-400/10"
                      >
                        清理
                      </button>
                    </div>
                  </div>
                )
              })}
              {!tasks.length && <EmptyState text="暂无生成日志" />}
          </div>
        </AdminTableShell>
      </SectionShell>
    )
  }

  function renderUpstreams() {
    const selectedFilteredUpstreamsCount = filteredUpstreams.filter((provider) => selectedUpstreamIds.includes(provider.id)).length
    return (
      <SectionShell
        title="上游渠道"
        description="管理真正转发到哪里调用。模型可以绑定到不同官方接口或兼容中转站。"
        action={
          <div className="grid w-full gap-2 md:grid-cols-2 xl:w-auto xl:grid-cols-[240px_120px_140px_auto]">
            <input
              value={upstreamQuery}
              onChange={(event) => setUpstreamQuery(event.target.value)}
              placeholder="搜索渠道、Base URL、绑定模型"
              className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
            />
            <select value={upstreamStatusFilter} onChange={(event) => setUpstreamStatusFilter(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <option value="all">全部状态</option>
              <option value="enabled">启用</option>
              <option value="disabled">停用</option>
            </select>
            <select value={upstreamHealthFilter} onChange={(event) => setUpstreamHealthFilter(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <option value="all">全部健康</option>
              <option value="healthy">可用</option>
              <option value="error">异常</option>
              <option value="unknown">未测试</option>
            </select>
            <button onClick={() => openUpstreamEditor()} className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-gray-950">新增渠道</button>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <label className="inline-flex items-center gap-2 font-semibold text-gray-500">
            <input
              type="checkbox"
              checked={filteredUpstreams.length > 0 && selectedFilteredUpstreamsCount === filteredUpstreams.length}
              onChange={(event) => toggleCurrentPageUpstreams(event.target.checked)}
              aria-label="选择当前页全部上游渠道"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            已选 {selectedFilteredUpstreamsCount} / 当前筛选 {filteredUpstreams.length}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!selectedUpstreamIds.length || upstreamBatchTesting}
              onClick={() => void batchTestUpstreams('selected')}
              className="h-8 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-blue-400/20 dark:hover:bg-blue-400/10"
            >
              检测已选
            </button>
            <button
              type="button"
              disabled={!upstreams.length || upstreamBatchTesting}
              onClick={() => void batchTestUpstreams('all')}
              className="h-8 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white dark:text-gray-950"
            >
              {upstreamBatchTesting ? '检测中' : '检测全部'}
            </button>
            <button
              type="button"
              disabled={!selectedUpstreamIds.length || upstreamBatchTesting}
              onClick={() => setSelectedUpstreamIds([])}
              className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]"
            >
              取消选择
            </button>
          </div>
        </div>
        <AdminTableShell mobileHint="横向滑动查看更多渠道字段和操作">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500 dark:border-white/[0.06] dark:bg-white/[0.04]">
            当前显示 <span className="font-semibold text-gray-900 dark:text-gray-100">{filteredUpstreams.length}</span> / {upstreams.length} 个渠道
          </div>
          <div className="min-w-[1280px]">
              <div className="sticky top-0 z-20 grid grid-cols-[34px_1fr_1.05fr_1.2fr_190px_90px_190px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-[#171a22]">
                <span />
                <span>渠道</span>
                <span>Base URL</span>
                <span>绑定模型</span>
                <span>诊断</span>
                <span>绑定</span>
                <span className="sticky right-0 z-20 -mr-4 bg-gray-50 py-0.5 pr-4 text-right shadow-[-18px_0_22px_-24px_rgba(15,23,42,0.8)] dark:bg-[#111827]">操作</span>
              </div>
              {filteredUpstreams.map((provider) => {
                const health = upstreamHealthSnapshot(provider, upstreamTests[provider.id])
                const checked = selectedUpstreamIds.includes(provider.id)
                return (
                  <div
                    key={provider.id}
                    className={cx('grid grid-cols-[34px_1fr_1.05fr_1.2fr_190px_90px_190px] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm transition last:border-0 dark:border-white/[0.06]', checked ? 'bg-blue-50/70 dark:bg-blue-400/10' : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]')}
                  >
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleUpstreamSelection(provider.id)}
                  aria-label={`选择上游渠道 ${provider.name}`}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-gray-950 dark:text-gray-50">{provider.name}</span>
                  <StatusBadge tone={provider.enabled ? 'green' : 'gray'}>{provider.enabled ? '启用' : '停用'}</StatusBadge>
                </div>
                <div className="mt-1 text-xs text-gray-400">优先级 {provider.priority} · 超时 {provider.timeoutSeconds}s</div>
              </div>
              <div className="truncate text-gray-600 dark:text-gray-300">{provider.baseUrl}</div>
              <div className="min-w-0">
                {provider.models?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {provider.models.slice(0, 3).map((model) => (
                      <span
                        key={model.id}
                        className={cx(
                          'max-w-[150px] truncate rounded-lg px-2 py-1 text-xs font-medium',
                          model.enabled ? 'bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400',
                        )}
                        title={`${model.displayName} / ${model.name} / ${model.costCredits} 积分`}
                      >
                        {model.displayName}
                      </span>
                    ))}
                    {provider.models.length > 3 && <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-white/[0.06]">+{provider.models.length - 3}</span>}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">未绑定模型</span>
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <StatusBadge tone={upstreamHealthTone(health.status)}>{upstreamHealthLabel(health.status)}</StatusBadge>
                <div className="truncate text-xs text-gray-400">
                  {health.checkedAt ? `${formatTime(health.checkedAt)} · ${health.latencyMs ?? '-'}ms · HTTP ${health.httpStatus || '-'}` : '尚未检测'}
                </div>
                {health.message && <div className="truncate text-[11px] text-gray-400" title={health.message}>{health.message}</div>}
              </div>
              <div className="text-gray-600 dark:text-gray-300">{provider._count?.models ?? 0} 个模型</div>
              <div className={cx('sticky right-0 z-10 -mr-4 flex justify-end gap-2 py-1 pr-4 shadow-[-18px_0_22px_-24px_rgba(15,23,42,0.75)]', checked ? 'bg-blue-50 dark:bg-[#172554]' : 'bg-white dark:bg-[#111827]')}>
                <button
                  type="button"
                  onClick={() => void testUpstream(provider.id)}
                  disabled={testingUpstreamId === provider.id}
                  className="h-9 rounded-xl border border-blue-100 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200"
                >
                  {testingUpstreamId === provider.id ? '测试中' : '测试连接'}
                </button>
                <button
                  type="button"
                  onClick={() => openUpstreamEditor(provider)}
                  className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100 dark:hover:bg-white/[0.08]"
                >
                  编辑
                </button>
              </div>
              </div>
            )
          })}
              {!filteredUpstreams.length && <EmptyState text={upstreams.length ? '暂无匹配的上游渠道' : '暂无上游渠道'} />}
          </div>
        </AdminTableShell>
      </SectionShell>
    )
  }

  function renderAnnouncements() {
    return (
      <SectionShell
        title="公告"
        description="用于前台运营通知、维护提醒、活动说明。"
        action={
          <div className="grid w-full gap-2 md:grid-cols-[minmax(220px,1fr)_120px_120px_120px_auto] xl:w-auto">
            <input
              value={announcementQuery}
              onChange={(event) => setAnnouncementQuery(event.target.value)}
              placeholder="搜索标题、内容、链接"
              className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
            />
            <select value={announcementStatusFilter} onChange={(event) => setAnnouncementStatusFilter(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <option value="all">全部状态</option>
              <option value="draft">草稿</option>
              <option value="published">发布</option>
              <option value="archived">归档</option>
            </select>
            <select value={announcementPlacementFilter} onChange={(event) => setAnnouncementPlacementFilter(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <option value="all">全部位置</option>
              <option value="global">全站</option>
              <option value="home">首页</option>
              <option value="workspace">工作台</option>
              <option value="square">广场</option>
            </select>
            <select value={announcementLevelFilter} onChange={(event) => setAnnouncementLevelFilter(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <option value="all">全部等级</option>
              <option value="info">通知</option>
              <option value="success">活动</option>
              <option value="warning">提醒</option>
              <option value="critical">重要</option>
            </select>
            <button onClick={() => openAnnouncementEditor()} className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-gray-950">新增公告</button>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <label className="inline-flex items-center gap-2 font-semibold text-gray-500">
            <input
              type="checkbox"
              checked={filteredAnnouncements.length > 0 && selectedAnnouncementIds.length === filteredAnnouncements.length}
              onChange={(event) => toggleCurrentPageAnnouncements(event.target.checked)}
              aria-label="选择当前筛选公告"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            已选 {selectedAnnouncementIds.length} / 当前筛选 {filteredAnnouncements.length}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!selectedAnnouncementIds.length || announcementBatchOperating} onClick={() => void batchPatchAnnouncements({ status: 'published' })} className="h-8 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-emerald-400/20 dark:hover:bg-emerald-400/10">批量发布</button>
            <button type="button" disabled={!selectedAnnouncementIds.length || announcementBatchOperating} onClick={() => void batchPatchAnnouncements({ status: 'draft' })} className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">设为草稿</button>
            <button type="button" disabled={!selectedAnnouncementIds.length || announcementBatchOperating} onClick={() => void batchPatchAnnouncements({ status: 'archived' })} className="h-8 rounded-lg border border-amber-200 px-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-amber-400/20 dark:hover:bg-amber-400/10">批量归档</button>
            <button type="button" disabled={!selectedAnnouncementIds.length || announcementBatchOperating} onClick={() => void batchPatchAnnouncements({ pinned: true })} className="h-8 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-blue-400/20 dark:hover:bg-blue-400/10">批量置顶</button>
            <button type="button" disabled={!selectedAnnouncementIds.length || announcementBatchOperating} onClick={() => void batchPatchAnnouncements({ pinned: false })} className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">取消置顶</button>
            <button type="button" disabled={!selectedAnnouncementIds.length || announcementBatchOperating} onClick={() => setSelectedAnnouncementIds([])} className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">取消选择</button>
          </div>
        </div>
        <AdminTableShell mobileHint="横向滑动查看更多公告字段和操作">
          <div className="min-w-[1500px]">
              <div className="sticky top-0 z-20 grid grid-cols-[34px_1.45fr_130px_105px_90px_220px_150px_145px_145px_300px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-[#171a22]">
                <span />
                <span>公告</span>
                <span>等级 / 位置</span>
                <span>状态</span>
                <span>置顶</span>
                <span>展示窗口</span>
                <span>动作入口</span>
                <span>创建时间</span>
                <span>更新时间</span>
                <span className="text-right">操作</span>
              </div>
              {filteredAnnouncements.map((item) => {
                const checked = selectedAnnouncementIds.includes(item.id)
                return (
                <div key={item.id} className={cx('grid grid-cols-[34px_1.45fr_130px_105px_90px_220px_150px_145px_145px_300px] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm transition last:border-0 dark:border-white/[0.06]', checked ? 'bg-blue-50/70 dark:bg-blue-400/10' : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]')}>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAnnouncementSelection(item.id)}
                      aria-label={`选择公告 ${item.title}`}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-gray-950 dark:text-gray-50">{item.title}</div>
                    <div className="mt-1 line-clamp-1 text-xs text-gray-400">{item.content}</div>
                  </div>
                  <div className="space-y-1">
                    <StatusBadge tone={announcementTone(item.level)}>{announcementLevelLabel(item.level)}</StatusBadge>
                    <div className="text-xs text-gray-400">{announcementPlacementLabel(item.placement)}</div>
                  </div>
                  <StatusBadge tone={item.status === 'published' ? 'green' : item.status === 'draft' ? 'gray' : 'amber'}>{announcementStatusLabel(item.status)}</StatusBadge>
                  <StatusBadge tone={item.pinned ? 'blue' : 'gray'}>{item.pinned ? '置顶' : '普通'}</StatusBadge>
                  <div className="text-xs leading-5 text-gray-500">
                    <div>开始 {formatTime(item.startsAt)}</div>
                    <div>结束 {formatTime(item.endsAt)}</div>
                  </div>
                  <div className="min-w-0 text-xs text-gray-500">
                    {item.actionLabel ? (
                      <>
                        <div className="truncate font-medium text-gray-700 dark:text-gray-200">{item.actionLabel}</div>
                        <div className="mt-1 truncate text-gray-400">{item.actionUrl || '-'}</div>
                      </>
                    ) : (
                      <span className="text-gray-400">无按钮</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{formatTime(item.createdAt)}</span>
                  <span className="text-xs text-gray-400">{formatTime(item.updatedAt)}</span>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <button type="button" onClick={() => setSelectedAnnouncementId(item.id)} className="h-8 rounded-lg border border-blue-200 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-400/20 dark:hover:bg-blue-400/10">预览</button>
                    <button type="button" onClick={() => openAnnouncementEditor(item)} className="h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">编辑</button>
                    <button type="button" onClick={() => void patchAnnouncement(item.id, { status: item.status === 'published' ? 'draft' : 'published' }, '公告状态已更新')} className={cx('h-8 rounded-lg border px-2.5 text-xs font-medium', item.status === 'published' ? 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/20 dark:hover:bg-emerald-400/10')}>{item.status === 'published' ? '设草稿' : '发布'}</button>
                    <button type="button" onClick={() => void patchAnnouncement(item.id, { status: 'archived' }, '公告已归档')} className="h-8 rounded-lg border border-amber-200 px-2.5 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-400/20 dark:hover:bg-amber-400/10">归档</button>
                    <button type="button" onClick={() => void patchAnnouncement(item.id, { pinned: !item.pinned }, '公告置顶状态已更新')} className="h-8 rounded-lg border border-blue-200 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-400/20 dark:hover:bg-blue-400/10">{item.pinned ? '取消置顶' : '置顶'}</button>
                  </div>
                </div>
              )})}
              {!filteredAnnouncements.length && <EmptyState text={announcements.length ? '暂无匹配的公告' : '暂无公告'} />}
          </div>
        </AdminTableShell>
      </SectionShell>
    )
  }

  function renderSettings() {
    return (
      <SectionShell title="平台设置" description="控制 ToC 平台的基础运营策略。适合临时维护、活动期调额和注册策略调整。">
        <form onSubmit={saveSettings} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
              <div className="mb-4">
                <div className="text-base font-semibold text-gray-950 dark:text-gray-50">访问策略</div>
                <div className="mt-1 text-sm text-gray-500">开关会立即影响用户注册和生成提交。</div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3 dark:border-white/[0.08]">
                  <span>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">开放注册</span>
                    <span className="mt-0.5 block text-xs text-gray-400">关闭后新用户无法创建账号</span>
                  </span>
                  <input type="checkbox" checked={settingsDraft.registerEnabled} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, registerEnabled: event.target.checked }))} />
                </label>
                <label className="flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3 dark:border-white/[0.08]">
                  <span>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">开放生成</span>
                    <span className="mt-0.5 block text-xs text-gray-400">关闭后用户无法提交生图任务</span>
                  </span>
                  <input type="checkbox" checked={settingsDraft.generationEnabled} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, generationEnabled: event.target.checked }))} />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
              <div className="mb-4">
                <div className="text-base font-semibold text-gray-950 dark:text-gray-50">积分策略</div>
                <div className="mt-1 text-sm text-gray-500">调整后只影响新注册用户，历史用户余额不会被批量修改。</div>
              </div>
              <label className="block text-xs font-semibold text-gray-500">
                注册赠送积分
                <input
                  type="number"
                  min={0}
                  max={100000}
                  value={settingsDraft.registerBonusCredits}
                  onChange={(event) => setSettingsDraft((prev) => ({ ...prev, registerBonusCredits: Number(event.target.value) }))}
                  className="mt-1.5 h-10 w-full max-w-xs rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                />
              </label>
              <label className="mt-4 block text-xs font-semibold text-gray-500">
                兑换码弹窗说明
                <textarea
                  value={settingsDraft.redeemDescription}
                  onChange={(event) => setSettingsDraft((prev) => ({ ...prev, redeemDescription: event.target.value }))}
                  rows={4}
                  maxLength={1000}
                  placeholder="例如：购买地址：https://example.com/buy，也可以填写客服说明、到账规则或活动备注。"
                  className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm leading-6 text-gray-900 outline-none transition focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                />
                <span className="mt-1.5 block text-[11px] font-normal text-gray-400">
                  支持换行和 http/https 链接，留空时前台不显示说明。
                </span>
              </label>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
              <div className="mb-4">
                <div className="text-base font-semibold text-gray-950 dark:text-gray-50">维护提示</div>
                <div className="mt-1 text-sm text-gray-500">关闭生成时，用户会看到这段中文提示。</div>
              </div>
              <textarea
                value={settingsDraft.maintenanceMessage}
                onChange={(event) => setSettingsDraft((prev) => ({ ...prev, maintenanceMessage: event.target.value }))}
                rows={5}
                placeholder="例如：图像生成服务正在维护，预计 20 分钟后恢复。"
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm leading-6 text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
              />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
              <div className="mb-4">
                <div className="text-base font-semibold text-gray-950 dark:text-gray-50">首页轮播图</div>
                <div className="mt-1 text-sm text-gray-500">配置首页首屏背景轮播。每项至少需要 imageUrl，可选 id、title、category、accent。</div>
              </div>
              <textarea
                value={settingsDraft.landingHeroSlidesJson}
                onChange={(event) => setSettingsDraft((prev) => ({ ...prev, landingHeroSlidesJson: event.target.value }))}
                rows={14}
                spellCheck={false}
                placeholder='[{"id":"cover-1","title":"首页图","category":"展示","imageUrl":"/landing/showcase/travel-portrait.png","accent":"#2563eb"}]'
                className="min-h-[320px] w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-xs leading-5 text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
          </div>

          <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="text-sm font-semibold text-gray-950 dark:text-gray-50">当前状态</div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-gray-500">注册</span><StatusBadge tone={settingsDraft.registerEnabled ? 'green' : 'red'}>{settingsDraft.registerEnabled ? '开放' : '关闭'}</StatusBadge></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">生成</span><StatusBadge tone={settingsDraft.generationEnabled ? 'green' : 'red'}>{settingsDraft.generationEnabled ? '开放' : '维护'}</StatusBadge></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">注册送分</span><span className="font-semibold text-amber-700">{settingsDraft.registerBonusCredits}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">兑换说明</span><StatusBadge tone={settingsDraft.redeemDescription.trim() ? 'green' : 'gray'}>{settingsDraft.redeemDescription.trim() ? '已配置' : '不显示'}</StatusBadge></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">首页轮播</span><StatusBadge tone={settingsDraft.landingHeroSlidesJson.trim() ? 'blue' : 'amber'}>{settingsDraft.landingHeroSlidesJson.trim() ? '已配置' : '待配置'}</StatusBadge></div>
            </div>
            <button className="mt-5 h-10 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-gray-950">保存设置</button>
          </aside>
        </form>
      </SectionShell>
    )
  }

  function renderLedgerDialog() {
    if (!selectedLedgerId) return null
    const selected = creditLedgers.find((ledger) => ledger.id === selectedLedgerId) ?? null
    if (!selected) return null

    return (
      <div className="absolute inset-0 z-20 grid place-items-center bg-gray-950/25 px-4 backdrop-blur-sm">
        <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-900">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-white/[0.08]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-base font-semibold text-gray-950 dark:text-gray-50">{selected.user?.email ?? selected.userId}</div>
                <StatusBadge tone={selected.delta > 0 ? 'green' : selected.delta < 0 ? 'red' : 'gray'}>
                  {selected.delta > 0 ? '+' : ''}{selected.delta}
                </StatusBadge>
              </div>
              <div className="mt-1 text-xs text-gray-400">流水 ID {selected.id} · {formatTime(selected.createdAt)}</div>
            </div>
            <button type="button" onClick={() => setSelectedLedgerId(null)} className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
          </div>

          <div className="max-h-[72vh] space-y-5 overflow-y-auto p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="流水类型" value={selected.delta > 0 ? '收入' : selected.delta < 0 ? '支出' : '无变化'} hint={selected.taskId ? '关联生成任务' : '运营操作'} />
              <StatCard label="变动积分" value={selected.delta > 0 ? `+${selected.delta}` : selected.delta} hint="本次流水变化值" />
              <StatCard label="余额快照" value={selected.balanceAfter} hint="变更后的用户余额" />
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">流水原因</div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm leading-6 text-gray-700 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-gray-200">{selected.reason}</div>
            </div>
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 text-sm dark:divide-white/[0.06] dark:border-white/[0.06]">
              <div className="flex justify-between gap-3 px-3 py-2"><span className="text-gray-500">用户</span><span className="truncate text-right font-medium">{selected.user?.email ?? selected.userId}</span></div>
              <div className="flex justify-between gap-3 px-3 py-2"><span className="text-gray-500">任务 ID</span><span className="truncate text-right font-medium">{selected.taskId ?? '-'}</span></div>
              <div className="flex justify-between gap-3 px-3 py-2"><span className="text-gray-500">创建时间</span><span className="text-right font-medium">{formatTime(selected.createdAt)}</span></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderTaskDialog() {
    if (!selectedTaskId) return null
    const selected = tasks.find((task) => task.id === selectedTaskId) ?? null
    if (!selected) return null

    return (
      <div className="absolute inset-0 z-20 grid place-items-center bg-gray-950/25 px-4 backdrop-blur-sm">
        <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-900">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-white/[0.08]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-base font-semibold text-gray-950 dark:text-gray-50">生成任务详情</div>
                <StatusBadge tone={taskTone(selected.status)}>{selected.status}</StatusBadge>
              </div>
              <div className="mt-1 text-xs text-gray-400">任务 ID {selected.id} · {formatTime(selected.createdAt)}</div>
            </div>
            <button type="button" onClick={() => setSelectedTaskId(null)} className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
          </div>

          <div className="max-h-[72vh] space-y-5 overflow-y-auto p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="消耗积分" value={selected.costCredits} hint="任务创建时快照" />
              <StatCard label="模型" value={selected.modelConfig?.displayName ?? '-'} hint={selected.modelConfig?.name ?? '未记录上游模型'} />
              <StatCard label="用户" value={selected.user?.email ?? '-'} hint={formatTime(selected.finishedAt) === '-' ? '尚未完成' : `完成于 ${formatTime(selected.finishedAt)}`} />
              <StatCard label="云端资产" value={selected.generatedAssets?.length ?? 0} hint="GeneratedAsset 独立表记录" />
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">完整提示词</div>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm leading-6 text-gray-700 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-gray-200">{selected.prompt}</div>
            </div>
            {selected.error && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-400">错误信息</div>
                <div className="max-h-48 overflow-auto rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">{selected.error}</div>
              </div>
            )}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">请求参数</div>
              <pre className="max-h-56 overflow-auto rounded-xl border border-gray-100 bg-gray-950 p-3 text-xs leading-5 text-gray-100 dark:border-white/[0.08]">{formatJson(taskRequestParams(selected))}</pre>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">返回参数</div>
              <pre className="max-h-72 overflow-auto rounded-xl border border-gray-100 bg-gray-950 p-3 text-xs leading-5 text-gray-100 dark:border-white/[0.08]">{formatJson(taskReturnParams(selected))}</pre>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">云端图片资产</div>
              <div className="space-y-2">
                {selected.generatedAssets?.map((asset) => (
                  <div key={asset.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-gray-300">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">#{asset.imageIndex + 1} · {asset.mimeType}</span>
                      <span className="text-gray-400">{formatAssetSize(asset.byteSize)} · {formatAssetDimensions(asset.width, asset.height)} · {asset.uploadMode ?? '-'}</span>
                    </div>
                    <div className="mt-2 truncate">R2 Key：{asset.r2Key || '外置接口未返回对象 Key'}</div>
                    <a href={asset.publicUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-blue-600 hover:underline dark:text-blue-300">
                      {getAssetHost(asset.publicUrl)} / 打开公开地址
                    </a>
                  </div>
                ))}
                {!(selected.generatedAssets?.length) && (
                  <EmptyState text={selected.status === 'done' ? '暂无云端资产记录，可能未开启自动上传或上传失败' : '任务尚未生成云端资产'} />
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <button
              type="button"
              onClick={() => setSelectedTaskId(null)}
              className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100 dark:hover:bg-white/[0.08]"
            >
              关闭
            </button>
            <button
              type="button"
              disabled={selected.status === 'running'}
              onClick={() => void deleteTask(selected.id)}
              className="h-10 rounded-xl border border-rose-200 px-4 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-rose-400/20 dark:hover:bg-rose-400/10"
            >
              清理日志
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderAnnouncementPreviewDialog() {
    if (!selectedAnnouncementId) return null
    const selected = announcements.find((item) => item.id === selectedAnnouncementId) ?? null
    if (!selected) return null

    const isActiveWindow = (!selected.startsAt || new Date(selected.startsAt).getTime() <= Date.now()) &&
      (!selected.endsAt || new Date(selected.endsAt).getTime() >= Date.now())

    return (
      <div className="absolute inset-0 z-20 grid place-items-center bg-gray-950/25 px-4 backdrop-blur-sm">
        <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-900">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-white/[0.08]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-base font-semibold text-gray-950 dark:text-gray-50">{selected.title}</div>
                <StatusBadge tone={announcementTone(selected.level)}>{announcementLevelLabel(selected.level)}</StatusBadge>
                <StatusBadge tone={selected.status === 'published' ? 'green' : selected.status === 'draft' ? 'gray' : 'amber'}>{announcementStatusLabel(selected.status)}</StatusBadge>
              </div>
              <div className="mt-1 text-xs text-gray-400">公告 ID {selected.id} · {announcementPlacementLabel(selected.placement)}</div>
            </div>
            <button type="button" onClick={() => setSelectedAnnouncementId(null)} className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
          </div>

          <div className="max-h-[72vh] space-y-5 overflow-y-auto p-5">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <div className={cx(
                'rounded-xl border px-4 py-3',
                selected.level === 'critical' ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100' :
                  selected.level === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100' :
                    selected.level === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100' :
                      'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100',
              )}>
                <div className="text-sm font-semibold">{selected.title}</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 opacity-90">{selected.content}</div>
                {selected.actionLabel && (
                  <div className="mt-3">
                    <span className="inline-flex h-8 items-center rounded-lg bg-white/80 px-3 text-xs font-semibold text-gray-900 shadow-sm dark:bg-gray-950/50 dark:text-gray-100">
                      {selected.actionLabel}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-3 text-xs text-gray-400">这是前台公告条的大致效果，实际位置会根据投放位置显示。</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-white/[0.06]">
                <div className="text-xs text-gray-400">展示状态</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusBadge tone={isActiveWindow ? 'green' : 'amber'}>{isActiveWindow ? '当前时间可展示' : '不在展示窗口'}</StatusBadge>
                  <StatusBadge tone={selected.pinned ? 'blue' : 'gray'}>{selected.pinned ? '置顶' : '普通'}</StatusBadge>
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-white/[0.06]">
                <div className="text-xs text-gray-400">动作入口</div>
                <div className="mt-1 break-all font-medium text-gray-900 dark:text-gray-100">{selected.actionLabel || '-'} {selected.actionUrl ? `· ${selected.actionUrl}` : ''}</div>
              </div>
              <div className="rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-white/[0.06]">
                <div className="text-xs text-gray-400">开始展示</div>
                <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{formatTime(selected.startsAt)}</div>
              </div>
              <div className="rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-white/[0.06]">
                <div className="text-xs text-gray-400">结束展示</div>
                <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{formatTime(selected.endsAt)}</div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/[0.08]">
              <button type="button" onClick={() => setSelectedAnnouncementId(null)} className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">关闭</button>
              <button type="button" onClick={() => { setSelectedAnnouncementId(null); openAnnouncementEditor(selected) }} className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">编辑</button>
              <button type="button" onClick={() => void patchAnnouncement(selected.id, { status: selected.status === 'published' ? 'draft' : 'published' }, '公告状态已更新', true)} className={cx('h-10 rounded-xl px-4 text-sm font-semibold', selected.status === 'published' ? 'border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-100 dark:hover:bg-white/[0.06]' : 'bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-gray-950')}>
                {selected.status === 'published' ? '设为草稿' : '发布公告'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderUserDialog() {
    if (!userDialogMode || !selectedUserId) return null
    const selected = selectedUserDetail?.user ?? users.find((item) => item.id === selectedUserId) ?? null
    if (!selected) return null

    return (
      <div className="absolute inset-0 z-20 grid place-items-center bg-gray-950/25 px-4 backdrop-blur-sm">
        <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-900">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-white/[0.08]">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-gray-950 dark:text-gray-50">{selected.email}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                <span>ID {selected.id} · {formatTime(selected.createdAt)}</span>
                <StatusBadge tone={userSegmentTone(selected.segment)}>{userSegmentLabel(selected.segment)}</StatusBadge>
              </div>
            </div>
            <button type="button" onClick={() => setUserDialogMode(null)} className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
          </div>

          {userDialogMode === 'credit' ? (
            <form onSubmit={adjustSelectedUserCredits} className="space-y-4 px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="当前积分" value={selected.creditBalance} hint="调整后会写入流水" />
                <StatCard label="生成任务" value={selected._count?.tasks ?? 0} hint="该用户累计任务" />
                <StatCard label="流水记录" value={selected._count?.ledgers ?? 0} hint="积分变动次数" />
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 dark:border-amber-400/15 dark:bg-amber-400/10">
                <div className="mb-3 text-sm font-semibold text-gray-950 dark:text-gray-50">积分调整</div>
                <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                  <input value={creditDelta} onChange={(event) => setCreditDelta(event.target.value)} type="number" className="h-10 rounded-xl border border-amber-200 bg-white px-3 text-sm outline-none focus:border-amber-400 dark:border-amber-400/20 dark:bg-gray-950" />
                  <input value={creditReason} onChange={(event) => setCreditReason(event.target.value)} placeholder="调整原因" className="h-10 rounded-xl border border-amber-200 bg-white px-3 text-sm outline-none focus:border-amber-400 dark:border-amber-400/20 dark:bg-gray-950" />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/[0.08]">
                <button type="button" onClick={() => setUserDialogMode(null)} className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">取消</button>
                <button className="h-10 rounded-xl bg-amber-600 px-5 text-sm font-semibold text-white hover:bg-amber-700">确认调整</button>
              </div>
            </form>
          ) : userDialogMode === 'password' ? (
            <form onSubmit={resetSelectedUserPassword} className="space-y-4 px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="账号状态" value={selected.status === 'active' ? '正常' : '禁用'} hint={selected.role === 'admin' ? '管理员账号' : '普通用户'} />
                <StatCard label="登录次数" value={selected.loginCount} hint={`最后登录 ${formatTime(selected.lastLoginAt)}`} />
                <StatCard label="用户积分" value={selected.creditBalance} hint="重置密码不影响积分" />
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 dark:border-violet-400/15 dark:bg-violet-400/10">
                <div className="mb-2 text-sm font-semibold text-gray-950 dark:text-gray-50">重置登录密码</div>
                <p className="mb-3 text-xs leading-5 text-gray-500 dark:text-gray-400">适用于客服核验后帮用户恢复账号。保存后旧密码立即失效，操作会写入审计日志。</p>
                <label className="block text-xs font-semibold text-gray-500">
                  新密码
                  <input
                    value={passwordDraft}
                    onChange={(event) => setPasswordDraft(event.target.value)}
                    type="password"
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    placeholder="至少 8 位"
                    className="mt-1.5 h-10 w-full rounded-xl border border-violet-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-violet-400 dark:border-violet-400/20 dark:bg-gray-950 dark:text-gray-100"
                    required
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/[0.08]">
                <button type="button" onClick={() => setUserDialogMode(null)} className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">取消</button>
                <button className="h-10 rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white hover:bg-violet-800">确认重置</button>
              </div>
            </form>
          ) : (
            <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5">
              {userDetailLoading && <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">正在同步用户详情...</div>}
              <div className="grid gap-3 sm:grid-cols-4">
                <StatCard label="积分" value={selected.creditBalance} hint="当前余额" />
                <StatCard label="生成" value={selected._count?.tasks ?? 0} hint="累计任务" />
                <StatCard label="流水" value={selected._count?.ledgers ?? 0} hint="积分记录" />
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
                  <div className="text-xs font-medium text-gray-400">状态</div>
                  <div className="mt-3 flex gap-2">
                    <StatusBadge tone={selected.role === 'admin' ? 'blue' : 'gray'}>{selected.role === 'admin' ? '管理员' : '用户'}</StatusBadge>
                    <StatusBadge tone={selected.status === 'active' ? 'green' : 'red'}>{selected.status === 'active' ? '正常' : '禁用'}</StatusBadge>
                    <StatusBadge tone={userSegmentTone(selected.segment)}>{userSegmentLabel(selected.segment)}</StatusBadge>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">账号画像</div>
                <div className="grid gap-2 rounded-2xl border border-gray-100 p-3 text-sm dark:border-white/[0.06] sm:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/[0.04]">
                    <div className="text-xs text-gray-400">最后登录</div>
                    <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{formatTime(selected.lastLoginAt)}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/[0.04]">
                    <div className="text-xs text-gray-400">登录次数</div>
                    <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{selected.loginCount}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/[0.04]">
                    <div className="text-xs text-gray-400">注册时间</div>
                    <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{formatTime(selected.createdAt)}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/[0.04]">
                    <div className="text-xs text-gray-400">更新时间</div>
                    <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{formatTime(selectedUserDetail?.user.updatedAt)}</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">账号安全</div>
                    <div className="mt-0.5 text-xs text-gray-400">最近登录尝试，便于判断密码错误、禁用账号访问和异常来源。</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUserDialogMode(null)
                      setLoginLogQuery(selected.email)
                      setLoginLogSuccess('all')
                      setLoginLogPage(1)
                      setTab('loginLogs')
                    }}
                    className="h-8 shrink-0 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]"
                  >
                    查看全部
                  </button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-white/[0.06]">
                  <div className="grid grid-cols-[86px_112px_120px_1fr_130px] gap-3 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-white/[0.04]">
                    <span>结果</span>
                    <span>原因</span>
                    <span>IP</span>
                    <span>设备</span>
                    <span>时间</span>
                  </div>
                  {selectedUserDetail?.loginLogs.map((log) => (
                    <div key={log.id} className="grid grid-cols-[86px_112px_120px_1fr_130px] items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-0 dark:border-white/[0.06]">
                      <StatusBadge tone={log.success ? 'green' : 'red'}>{log.success ? '成功' : '失败'}</StatusBadge>
                      <StatusBadge tone={loginReasonTone(log)}>{loginReasonLabel(log.reason)}</StatusBadge>
                      <span className="truncate font-mono text-xs text-gray-500">{log.ip ?? '-'}</span>
                      <span className="truncate text-xs text-gray-500" title={log.userAgent ?? ''}>{compactUserAgent(log.userAgent)}</span>
                      <span className="text-xs text-gray-400">{formatTime(log.createdAt)}</span>
                    </div>
                  ))}
                  {selectedUserDetail && !selectedUserDetail.loginLogs.length && <EmptyState text="该用户暂无登录日志" />}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">最近订单</div>
                      <div className="mt-0.5 text-xs text-gray-400">充值套餐、支付状态和到账积分。</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUserDialogMode(null)
                        setOrderQuery(selected.email)
                        setOrderStatus('all')
                        setOrderPage(1)
                        setTab('billing')
                      }}
                      className="h-8 shrink-0 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]"
                    >
                      查看全部
                    </button>
                  </div>
                  <div className="space-y-2">
                    {selectedUserDetail?.creditOrders.map((order) => (
                      <div key={order.id} className="rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-white/[0.06]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{order.packageName}</div>
                            <div className="mt-1 truncate text-xs text-gray-400">{order.orderNo} · {formatTime(order.createdAt)}</div>
                          </div>
                          <StatusBadge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</StatusBadge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span>{formatPrice(order.priceCents, order.currency)}</span>
                          <span>{order.totalCredits} 积分</span>
                          <span>{order.paymentMethod}</span>
                        </div>
                      </div>
                    ))}
                    {selectedUserDetail && !selectedUserDetail.creditOrders.length && <EmptyState text="该用户暂无订单" />}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">反馈工单</div>
                      <div className="mt-0.5 text-xs text-gray-400">客服处理记录、问题分类和优先级。</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUserDialogMode(null)
                        setTicketQuery(selected.email)
                        setTicketStatus('all')
                        setTicketPriority('all')
                        setTicketPage(1)
                        setTab('tickets')
                      }}
                      className="h-8 shrink-0 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]"
                    >
                      查看全部
                    </button>
                  </div>
                  <div className="space-y-2">
                    {selectedUserDetail?.supportTickets.map((ticket) => (
                      <div key={ticket.id} className="rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-white/[0.06]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{ticket.title}</div>
                            <div className="mt-1 truncate text-xs text-gray-400">{ticketCategoryLabel(ticket.category)} · {formatTime(ticket.createdAt)}</div>
                          </div>
                          <StatusBadge tone={ticket.status === 'resolved' || ticket.status === 'closed' ? 'green' : ticket.priority === 'urgent' || ticket.priority === 'high' ? 'red' : 'amber'}>{ticketStatusLabel(ticket.status)}</StatusBadge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span>{ticketPriorityLabel(ticket.priority)}</span>
                          {ticket.contact && <span className="truncate">联系方式 {ticket.contact}</span>}
                          {ticket.relatedOrderNo && <span className="truncate">订单 {ticket.relatedOrderNo}</span>}
                        </div>
                      </div>
                    ))}
                    {selectedUserDetail && !selectedUserDetail.supportTickets.length && <EmptyState text="该用户暂无反馈工单" />}
                  </div>
                </div>
              </div>

              <form onSubmit={saveSelectedUserOpsProfile} className="rounded-2xl border border-gray-100 p-3 dark:border-white/[0.06]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">运营档案</div>
                    <div className="mt-0.5 text-xs text-gray-400">用于客服排查、活动分层和风险用户标记。</div>
                  </div>
                  <button className="h-9 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-gray-950">保存档案</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <label className="block text-xs font-semibold text-gray-500">
                    用户分层
                    <select
                      value={userOpsDraft.segment}
                      onChange={(event) => setUserOpsDraft((prev) => ({ ...prev, segment: event.target.value as AdminUserSummary['segment'] }))}
                      className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                    >
                      <option value="normal">普通</option>
                      <option value="vip">VIP</option>
                      <option value="trial">试用</option>
                      <option value="risk">风险</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-gray-500">
                    运营备注
                    <textarea
                      value={userOpsDraft.adminNote}
                      onChange={(event) => setUserOpsDraft((prev) => ({ ...prev, adminNote: event.target.value }))}
                      rows={3}
                      placeholder="记录客服沟通、活动来源、异常行为等，仅后台可见"
                      className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal leading-6 text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                    />
                  </label>
                </div>
              </form>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">管理操作</div>
                    <div className="mt-0.5 text-xs text-gray-400">最近针对该用户的后台变更，便于追溯调分、状态、角色和密码操作。</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUserDialogMode(null)
                      setAuditQuery(selected.id)
                      setAuditAction('user.')
                      setAuditPage(1)
                      setTab('audit')
                    }}
                    className="h-8 shrink-0 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]"
                  >
                    查看全部
                  </button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-white/[0.06]">
                  <div className="grid grid-cols-[1fr_1fr_120px_140px] gap-3 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-white/[0.04]">
                    <span>动作</span>
                    <span>操作者</span>
                    <span>IP</span>
                    <span>时间</span>
                  </div>
                  {selectedUserDetail?.auditLogs.map((log) => (
                    <div key={log.id} className="grid grid-cols-[1fr_1fr_120px_140px] items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-0 dark:border-white/[0.06]">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{log.action}</div>
                        <div className="mt-0.5 truncate text-xs text-gray-400">ID {log.id.slice(0, 12)}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-gray-700 dark:text-gray-200">{log.actor?.email ?? log.actorId ?? '系统/未知'}</div>
                        <div className="mt-0.5 text-[11px] text-gray-400">{log.actor?.role === 'admin' ? '管理员' : log.actor ? '用户' : '-'}</div>
                      </div>
                      <span className="truncate font-mono text-xs text-gray-500">{log.ip ?? '-'}</span>
                      <span className="text-xs text-gray-400">{formatTime(log.createdAt)}</span>
                    </div>
                  ))}
                  {selectedUserDetail && !selectedUserDetail.auditLogs.length && <EmptyState text="该用户暂无管理操作记录" />}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">最近生成</div>
                <div className="space-y-2">
                  {selectedUserDetail?.tasks.map((task) => (
                    <div key={task.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm dark:border-white/[0.06] dark:bg-white/[0.04]">
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge tone={taskTone(task.status)}>{task.status}</StatusBadge>
                        <span className="text-xs text-gray-400">{task.costCredits} 积分</span>
                      </div>
                      <div className="mt-2 line-clamp-2 text-gray-700 dark:text-gray-200">{task.prompt}</div>
                      <div className="mt-1 text-xs text-gray-400">{task.modelConfig?.displayName ?? '-'} · {formatTime(task.createdAt)}</div>
                    </div>
                  ))}
                  {selectedUserDetail && !selectedUserDetail.tasks.length && <EmptyState text="该用户暂无生成任务" />}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">积分流水</div>
                <div className="space-y-2">
                  {selectedUserDetail?.ledgers.map((ledger) => (
                    <div key={ledger.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-white/[0.06]">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-800 dark:text-gray-100">{ledger.reason}</div>
                        <div className="mt-0.5 text-xs text-gray-400">{formatTime(ledger.createdAt)} · 余额 {ledger.balanceAfter}</div>
                      </div>
                      <span className={cx('font-semibold', ledger.delta > 0 ? 'text-emerald-600' : 'text-rose-600')}>{ledger.delta > 0 ? '+' : ''}{ledger.delta}</span>
                    </div>
                  ))}
                  {selectedUserDetail && !selectedUserDetail.ledgers.length && <EmptyState text="该用户暂无积分流水" />}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderTicketDialog() {
    const selected = supportTickets.find((item) => item.id === selectedTicketId) ?? null
    if (!selected) return null

    return (
      <div className="absolute inset-0 z-30 grid place-items-center bg-gray-950/30 px-4 backdrop-blur-sm">
        <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-900">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-white/[0.08]">
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold text-gray-950 dark:text-gray-50">{selected.title}</div>
              <div className="mt-1 text-xs text-gray-400">ID {selected.id} · {formatTime(selected.createdAt)}</div>
            </div>
            <button type="button" onClick={() => setSelectedTicketId(null)} className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
          </div>
          <div className="max-h-[calc(86vh-74px)] overflow-y-auto px-5 py-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <StatCard label="用户" value={selected.user?.email ?? selected.userId} hint={selected.contact || '无联系方式'} />
              <StatCard label="分类" value={ticketCategoryLabel(selected.category)} hint={selected.relatedTaskId || selected.relatedOrderNo || '无关联'} />
              <StatCard label="优先级" value={ticketPriorityLabel(selected.priority)} hint="客服处理优先顺序" />
              <StatCard label="状态" value={ticketStatusLabel(selected.status)} hint={selected.repliedAt ? `回复于 ${formatTime(selected.repliedAt)}` : '尚未回复'} />
            </div>
            <div className="mt-4 rounded-2xl border border-gray-200 p-4 dark:border-white/[0.08]">
              <div className="mb-2 text-sm font-semibold text-gray-950 dark:text-gray-50">用户描述</div>
              <div className="whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">{selected.content}</div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-gray-500">
                状态
                <select value={selected.status} onChange={(event) => void patchSupportTicket(selected.id, { status: event.target.value as SupportTicket['status'] })} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100">
                  <option value="open">待处理</option>
                  <option value="in_progress">处理中</option>
                  <option value="resolved">已解决</option>
                  <option value="closed">已关闭</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-500">
                优先级
                <select value={selected.priority} onChange={(event) => void patchSupportTicket(selected.id, { priority: event.target.value as SupportTicket['priority'] })} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100">
                  <option value="urgent">紧急</option>
                  <option value="high">高</option>
                  <option value="normal">普通</option>
                  <option value="low">低</option>
                </select>
              </label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-gray-500">
                回复用户
                <textarea
                  defaultValue={selected.adminReply}
                  rows={6}
                  id="ticket-admin-reply"
                  className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal leading-6 text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                />
              </label>
              <label className="block text-xs font-semibold text-gray-500">
                内部备注
                <textarea
                  defaultValue={selected.adminNote}
                  rows={6}
                  id="ticket-admin-note"
                  className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal leading-6 text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSelectedTicketId(null)} className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">关闭</button>
              <button
                type="button"
                onClick={() => {
                  const reply = (document.getElementById('ticket-admin-reply') as HTMLTextAreaElement | null)?.value ?? ''
                  const note = (document.getElementById('ticket-admin-note') as HTMLTextAreaElement | null)?.value ?? ''
                  void patchSupportTicket(selected.id, { adminReply: reply, adminNote: note, status: reply ? 'resolved' : selected.status })
                }}
                className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-gray-950"
              >
                保存处理
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderEditorDrawer() {
    if (!activeEditor) return null

    return (
      <div className="absolute inset-0 z-20 flex justify-end bg-gray-950/25 backdrop-blur-sm">
        <button type="button" aria-label="关闭编辑抽屉" className="hidden flex-1 cursor-default md:block" onClick={closeEditor} />
        <div className="flex h-full w-full max-w-[520px] flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-900">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-white/[0.08]">
            <div>
              <div className="text-base font-semibold text-gray-950 dark:text-gray-50">
                {activeEditor === 'model' && (editingModelId ? '编辑模型' : '新增模型')}
                {activeEditor === 'upstream' && (editingUpstreamId ? '编辑上游渠道' : '新增上游渠道')}
                {activeEditor === 'announcement' && (editingAnnouncementId ? '编辑公告' : '新增公告')}
                {activeEditor === 'redeemCode' && (editingRedeemCodeId ? '编辑兑换码' : '新增兑换码')}
                {activeEditor === 'creditPackage' && (editingCreditPackageId ? '编辑积分套餐' : '新增积分套餐')}
                {activeEditor === 'moderationRule' && (editingModerationRuleId ? '编辑风控规则' : '新增风控规则')}
              </div>
              <div className="mt-1 text-sm text-gray-500">保存后会同步刷新当前列表。</div>
            </div>
            <button type="button" onClick={closeEditor} className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
          </div>

          {activeEditor === 'model' && (
            <ModelConfigDrawer
              editingModelId={editingModelId}
              draft={modelDraft}
              setDraft={setModelDraft}
              upstreams={upstreams}
              onSubmit={saveModel}
              onClose={closeEditor}
              onDelete={() => void deleteModel()}
              onError={(message) => showToast(message, 'error')}
            />
          )}

          {activeEditor === 'upstream' && (
            <UpstreamConfigDrawer
              editingUpstreamId={editingUpstreamId}
              draft={upstreamDraft}
              setDraft={setUpstreamDraft}
              upstreams={upstreams}
              upstreamTests={upstreamTests}
              testingUpstreamId={testingUpstreamId}
              onSubmit={saveUpstream}
              onClose={closeEditor}
              onDelete={() => void deleteUpstream()}
              onTest={(id) => void testUpstream(id)}
            />
          )}

          {activeEditor === 'announcement' && (
            <form onSubmit={saveAnnouncement} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <label className="block text-xs font-semibold text-gray-500">
                标题
                <input value={announcementDraft.title} onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, title: event.target.value }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" required />
              </label>
              <label className="block text-xs font-semibold text-gray-500">
                内容
                <textarea value={announcementDraft.content} onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, content: event.target.value }))} rows={8} className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal leading-6 text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" required />
              </label>
              <div className="rounded-2xl border border-gray-200 p-3 dark:border-white/[0.08]">
                <div className="mb-3 text-xs font-semibold text-gray-500">投放配置</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block text-xs font-semibold text-gray-500">
                    状态
                    <select value={announcementDraft.status} onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, status: event.target.value as AnnouncementDraft['status'] }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100">
                      <option value="draft">草稿</option>
                      <option value="published">发布</option>
                      <option value="archived">归档</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-gray-500">
                    公告等级
                    <select value={announcementDraft.level} onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, level: event.target.value as AnnouncementDraft['level'] }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100">
                      <option value="info">通知</option>
                      <option value="success">活动</option>
                      <option value="warning">提醒</option>
                      <option value="critical">重要</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-gray-500">
                    展示位置
                    <select value={announcementDraft.placement} onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, placement: event.target.value as AnnouncementDraft['placement'] }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100">
                      <option value="global">全站</option>
                      <option value="home">首页</option>
                      <option value="workspace">工作台</option>
                      <option value="square">广场</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-gray-500">
                    按钮文案
                    <input value={announcementDraft.actionLabel} onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, actionLabel: event.target.value }))} placeholder="例如：查看活动" className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
                  </label>
                  <label className="block text-xs font-semibold text-gray-500">
                    按钮链接
                    <input value={announcementDraft.actionUrl} onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, actionUrl: event.target.value }))} placeholder="https:// 或站内路径" className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
                  </label>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-gray-500">
                  开始展示
                  <input
                    type="datetime-local"
                    value={formatDateTimeInput(announcementDraft.startsAt)}
                    onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, startsAt: event.target.value ? new Date(event.target.value).toISOString() : null }))}
                    className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-500">
                  结束展示
                  <input
                    type="datetime-local"
                    value={formatDateTimeInput(announcementDraft.endsAt)}
                    onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, endsAt: event.target.value ? new Date(event.target.value).toISOString() : null }))}
                    className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                  />
                </label>
              </div>
              <label className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/[0.08]">
                置顶公告
                <input type="checkbox" checked={announcementDraft.pinned} onChange={(event) => setAnnouncementDraft((prev) => ({ ...prev, pinned: event.target.checked }))} />
              </label>
              <div className="sticky bottom-0 -mx-5 mt-6 flex gap-2 border-t border-gray-100 bg-white px-5 py-4 dark:border-white/[0.08] dark:bg-gray-900">
                {editingAnnouncementId && <button type="button" onClick={() => void deleteAnnouncement()} className="h-10 rounded-xl border border-rose-200 px-4 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-400/20 dark:hover:bg-rose-400/10">删除</button>}
                <button type="button" onClick={closeEditor} className="h-10 flex-1 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">取消</button>
                <button className="h-10 flex-1 rounded-xl bg-slate-950 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-gray-950">保存公告</button>
              </div>
            </form>
          )}

          {activeEditor === 'redeemCode' && (
            <form onSubmit={saveRedeemCode} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-gray-500">
                  兑换码
                  <input
                    value={redeemCodeDraft.code}
                    onChange={(event) => setRedeemCodeDraft((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                    placeholder="SUMMER100"
                    className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 font-mono text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                    required
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-500">
                  活动名
                  <input
                    value={redeemCodeDraft.name}
                    onChange={(event) => setRedeemCodeDraft((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="暑期活动补贴"
                    className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                    required
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-xs font-semibold text-gray-500">
                  积分
                  <input type="number" min={1} value={redeemCodeDraft.credits} onChange={(event) => setRedeemCodeDraft((prev) => ({ ...prev, credits: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
                </label>
                <label className="block text-xs font-semibold text-gray-500">
                  总领取次数
                  <input type="number" min={1} value={redeemCodeDraft.maxRedemptions} onChange={(event) => setRedeemCodeDraft((prev) => ({ ...prev, maxRedemptions: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
                </label>
                <label className="block text-xs font-semibold text-gray-500">
                  每人限制
                  <input type="number" min={1} value={redeemCodeDraft.perUserLimit} onChange={(event) => setRedeemCodeDraft((prev) => ({ ...prev, perUserLimit: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-gray-500">
                  开始时间
                  <input
                    type="datetime-local"
                    value={formatDateTimeInput(redeemCodeDraft.startsAt)}
                    onChange={(event) => setRedeemCodeDraft((prev) => ({ ...prev, startsAt: event.target.value ? new Date(event.target.value).toISOString() : null }))}
                    className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-500">
                  结束时间
                  <input
                    type="datetime-local"
                    value={formatDateTimeInput(redeemCodeDraft.endsAt)}
                    onChange={(event) => setRedeemCodeDraft((prev) => ({ ...prev, endsAt: event.target.value ? new Date(event.target.value).toISOString() : null }))}
                    className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold text-gray-500">
                备注
                <textarea
                  value={redeemCodeDraft.note}
                  onChange={(event) => setRedeemCodeDraft((prev) => ({ ...prev, note: event.target.value }))}
                  rows={4}
                  placeholder="记录投放渠道、活动批次或客服工单号"
                  className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal leading-6 text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/[0.08]">
                可用状态
                <input type="checkbox" checked={redeemCodeDraft.status === 'active'} onChange={(event) => setRedeemCodeDraft((prev) => ({ ...prev, status: event.target.checked ? 'active' : 'disabled' }))} />
              </label>
              <div className="sticky bottom-0 -mx-5 mt-6 flex gap-2 border-t border-gray-100 bg-white px-5 py-4 dark:border-white/[0.08] dark:bg-gray-900">
                {editingRedeemCodeId && <button type="button" onClick={() => void deleteRedeemCode(editingRedeemCodeId)} className="h-10 rounded-xl border border-rose-200 px-4 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-400/20 dark:hover:bg-rose-400/10">删除</button>}
                <button type="button" onClick={closeEditor} className="h-10 flex-1 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">取消</button>
                <button className="h-10 flex-1 rounded-xl bg-slate-950 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-gray-950">保存兑换码</button>
              </div>
            </form>
          )}

          {activeEditor === 'creditPackage' && (
            <form onSubmit={saveCreditPackage} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-gray-500">
                  套餐名称
                  <input value={creditPackageDraft.name} onChange={(event) => setCreditPackageDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="创作者套餐" className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" required />
                </label>
                <label className="block text-xs font-semibold text-gray-500">
                  标签
                  <input value={creditPackageDraft.badge} onChange={(event) => setCreditPackageDraft((prev) => ({ ...prev, badge: event.target.value }))} placeholder="热门 / 高性价比" className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
                </label>
              </div>
              <label className="block text-xs font-semibold text-gray-500">
                说明
                <textarea value={creditPackageDraft.description} onChange={(event) => setCreditPackageDraft((prev) => ({ ...prev, description: event.target.value }))} rows={4} placeholder="用于前台充值弹窗展示" className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal leading-6 text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-xs font-semibold text-gray-500">
                  基础积分
                  <input type="number" min={1} value={creditPackageDraft.credits} onChange={(event) => setCreditPackageDraft((prev) => ({ ...prev, credits: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
                </label>
                <label className="block text-xs font-semibold text-gray-500">
                  赠送积分
                  <input type="number" min={0} value={creditPackageDraft.bonusCredits} onChange={(event) => setCreditPackageDraft((prev) => ({ ...prev, bonusCredits: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
                </label>
                <label className="block text-xs font-semibold text-gray-500">
                  价格（分）
                  <input type="number" min={0} value={creditPackageDraft.priceCents} onChange={(event) => setCreditPackageDraft((prev) => ({ ...prev, priceCents: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-gray-500">
                  币种
                  <input value={creditPackageDraft.currency} onChange={(event) => setCreditPackageDraft((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
                </label>
                <label className="block text-xs font-semibold text-gray-500">
                  排序
                  <input type="number" value={creditPackageDraft.sortOrder} onChange={(event) => setCreditPackageDraft((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
                </label>
              </div>
              <label className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/[0.08]">
                前台上架
                <input type="checkbox" checked={creditPackageDraft.enabled} onChange={(event) => setCreditPackageDraft((prev) => ({ ...prev, enabled: event.target.checked }))} />
              </label>
              <div className="sticky bottom-0 -mx-5 mt-6 flex gap-2 border-t border-gray-100 bg-white px-5 py-4 dark:border-white/[0.08] dark:bg-gray-900">
                {editingCreditPackageId && <button type="button" onClick={() => void deleteCreditPackage(editingCreditPackageId)} className="h-10 rounded-xl border border-rose-200 px-4 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-400/20 dark:hover:bg-rose-400/10">删除</button>}
                <button type="button" onClick={closeEditor} className="h-10 flex-1 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">取消</button>
                <button className="h-10 flex-1 rounded-xl bg-slate-950 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-gray-950">保存套餐</button>
              </div>
            </form>
          )}

          {activeEditor === 'moderationRule' && (
            <form onSubmit={saveModerationRule} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-gray-500">
                  规则名称
                  <input value={moderationRuleDraft.name} onChange={(event) => setModerationRuleDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="敏感词拦截" className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" required />
                </label>
                <label className="block text-xs font-semibold text-gray-500">
                  类型
                  <select value={moderationRuleDraft.type} onChange={(event) => setModerationRuleDraft((prev) => ({ ...prev, type: event.target.value as ModerationRuleDraft['type'] }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100">
                    <option value="keyword">关键词</option>
                    <option value="regex">正则</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-gray-500">
                匹配内容
                <input value={moderationRuleDraft.pattern} onChange={(event) => setModerationRuleDraft((prev) => ({ ...prev, pattern: event.target.value }))} placeholder={moderationRuleDraft.type === 'regex' ? '例如：违法|违规' : '例如：敏感词'} className={cx('mt-1.5 h-10 w-full rounded-xl border bg-white px-3 font-mono text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:bg-gray-950 dark:text-gray-100', moderationPatternError ? 'border-rose-300 focus:border-rose-400 dark:border-rose-400/40' : 'border-gray-200 dark:border-white/[0.08]')} required />
                {moderationPatternError && <span className="mt-1.5 block text-xs font-medium text-rose-600 dark:text-rose-300">{moderationPatternError}</span>}
              </label>
              <label className="block text-xs font-semibold text-gray-500">
                拦截提示
                <textarea value={moderationRuleDraft.message} onChange={(event) => setModerationRuleDraft((prev) => ({ ...prev, message: event.target.value }))} rows={4} className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal leading-6 text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-gray-500">
                  优先级
                  <input type="number" value={moderationRuleDraft.priority} onChange={(event) => setModerationRuleDraft((prev) => ({ ...prev, priority: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
                </label>
                <label className="block text-xs font-semibold text-gray-500">
                  备注
                  <input value={moderationRuleDraft.note} onChange={(event) => setModerationRuleDraft((prev) => ({ ...prev, note: event.target.value }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
                </label>
              </div>
              <label className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/[0.08]">
                启用规则
                <input type="checkbox" checked={moderationRuleDraft.enabled} onChange={(event) => setModerationRuleDraft((prev) => ({ ...prev, enabled: event.target.checked }))} />
              </label>
              <div className="sticky bottom-0 -mx-5 mt-6 flex gap-2 border-t border-gray-100 bg-white px-5 py-4 dark:border-white/[0.08] dark:bg-gray-900">
                {editingModerationRuleId && <button type="button" onClick={() => void deleteModerationRule(editingModerationRuleId)} className="h-10 rounded-xl border border-rose-200 px-4 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-400/20 dark:hover:bg-rose-400/10">删除</button>}
                <button type="button" onClick={closeEditor} className="h-10 flex-1 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">取消</button>
                <button disabled={Boolean(moderationPatternError)} className="h-10 flex-1 rounded-xl bg-slate-950 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950">保存规则</button>
              </div>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[90] bg-[#f5f7fb] text-gray-950 dark:bg-gray-950 dark:text-gray-50">
      <div className="flex h-full">
        <aside className="hidden w-72 flex-shrink-0 border-r border-gray-200 bg-white px-4 py-5 dark:border-white/[0.08] dark:bg-gray-900 md:flex md:flex-col">
          <div className="mb-6 px-2">
            <div className="text-lg font-semibold tracking-tight">运营控制台</div>
            <div className="mt-1 text-xs text-gray-400">GPT Image Playground Admin</div>
          </div>
          <nav className="-mx-1 flex-1 space-y-2 overflow-y-auto pr-1">
            {navGroups.map((group) => {
              const activeGroup = group.items.some((item) => item.id === tab)
              const expanded = expandedNavGroupIds.includes(group.id)
              const visual = navGroupVisuals[group.id] ?? navGroupVisuals.insight
              return (
                <div key={group.id} className="rounded-2xl">
                  <button
                    type="button"
                    onClick={() => toggleNavGroup(group.id)}
                    aria-expanded={expanded}
                    className={cx(
                      'flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left ring-1 transition',
                      activeGroup ? visual.activeShell : `${visual.shell} hover:brightness-[0.98] dark:hover:bg-white/[0.08]`,
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black shadow-lg', visual.icon)}>
                        {visual.mark}
                      </span>
                      <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{group.label}</span>
                        {activeGroup && <span className={cx('h-1.5 w-1.5 rounded-full', visual.dot)} />}
                      </span>
                        <span className="mt-0.5 block truncate text-xs opacity-65">{group.caption}</span>
                      </span>
                    </span>
                    <span className={cx('shrink-0 text-xs transition-transform', visual.accent, expanded ? 'rotate-180' : 'rotate-0')}>⌄</span>
                  </button>
                  {expanded && (
                    <div className={cx('mt-1 space-y-1 border-l pl-3', activeGroup ? 'border-slate-300 dark:border-white/20' : 'border-gray-200/80 dark:border-white/[0.08]')}>
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setTab(item.id)}
                          className={cx(
                            'w-full rounded-2xl px-3 py-2.5 text-left transition',
                            tab === item.id ? visual.itemActive : visual.itemIdle,
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">{item.label}</span>
                            {tab === item.id && <span className={cx('h-1.5 w-1.5 rounded-full', visual.dot)} />}
                          </div>
                          <div className={cx('mt-0.5 truncate text-xs', tab === item.id ? 'opacity-65' : visual.itemCaption)}>{item.caption}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white/90 px-4 backdrop-blur dark:border-white/[0.08] dark:bg-gray-900/90 md:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="min-w-0 shrink-0">
                <div className="truncate text-sm text-gray-400">{activeNav.caption}</div>
                <div className="truncate text-base font-semibold">{activeNav.label}</div>
              </div>
              <AdminQuickSwitch activeTab={tab} onSelect={setTab} />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={tab}
                onChange={(event) => setTab(event.target.value as AdminTab)}
                className="h-9 max-w-[128px] rounded-full border border-gray-200 bg-white px-3 text-sm font-medium outline-none md:hidden dark:border-white/[0.08] dark:bg-white/[0.04]"
                aria-label="切换后台模块"
              >
                {navItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              <button onClick={() => void loadAll(tab)} className="shrink-0 whitespace-nowrap rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04] md:text-sm">刷新</button>
              <button onClick={closeAdminConsole} className="shrink-0 whitespace-nowrap rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-gray-950 md:text-sm">返回前台</button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-hidden p-4 md:p-6">
            {loading && <div className="mb-4 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700">正在加载...</div>}
            {tab === 'overview' && renderOverview()}
            {tab === 'reports' && renderReports()}
            {tab === 'users' && (
              <UsersSection
                users={users}
                usersPage={usersPage}
                usersTotal={usersTotal}
                query={query}
                userRoleFilter={userRoleFilter}
                userStatusFilter={userStatusFilter}
                userSegmentFilter={userSegmentFilter}
                selectedUserIds={selectedUserIds}
                batchOperating={batchOperating}
                batchCreditDelta={batchCreditDelta}
                batchCreditReason={batchCreditReason}
                setQuery={setQuery}
                setUserRoleFilter={setUserRoleFilter}
                setUserStatusFilter={setUserStatusFilter}
                setUserSegmentFilter={setUserSegmentFilter}
                setUsersPage={setUsersPage}
                setBatchCreditDelta={setBatchCreditDelta}
                setBatchCreditReason={setBatchCreditReason}
                toggleCurrentPageUsers={toggleCurrentPageUsers}
                toggleUserSelection={toggleUserSelection}
                batchUpdateUsersStatus={(status) => void batchUpdateUsersStatus(status)}
                batchAdjustUsersCredits={batchAdjustUsersCredits}
                exportUsers={() => void exportUsers()}
                openUserDetail={(userId) => {
                  setSelectedUserId(userId)
                  setUserDialogMode('detail')
                  void loadUserDetail(userId)
                }}
                openCreditDialog={(userId) => {
                  setSelectedUserId(userId)
                  setCreditDelta('100')
                  setCreditReason('运营补发')
                  setUserDialogMode('credit')
                }}
                openPasswordDialog={(userId) => {
                  setSelectedUserId(userId)
                  setPasswordDraft('')
                  setUserDialogMode('password')
                }}
                patchUser={(userId, input) => void patchUser(userId, input)}
              />
            )}
            {tab === 'loginLogs' && (
              <LoginLogsSection
                loginLogs={loginLogs}
                loginLogTotal={loginLogTotal}
                loginLogPage={loginLogPage}
                pageSize={adminPageSize}
                loginLogQuery={loginLogQuery}
                loginLogSuccess={loginLogSuccess}
                loginLogFrom={loginLogFrom}
                loginLogTo={loginLogTo}
                setLoginLogQuery={setLoginLogQuery}
                setLoginLogSuccess={setLoginLogSuccess}
                setLoginLogFrom={setLoginLogFrom}
                setLoginLogTo={setLoginLogTo}
                setLoginLogPage={setLoginLogPage}
                setSelectedLoginLogId={setSelectedLoginLogId}
                onExport={() => void exportLoginLogs()}
              />
            )}
            {tab === 'credits' && renderCredits()}
            {tab === 'redeemCodes' && (
              <RedeemCodesSection
                redeemCodes={redeemCodes}
                redeemCodeQuery={redeemCodeQuery}
                redeemCodeStatus={redeemCodeStatus}
                redeemCodePage={redeemCodePage}
                redeemCodeTotal={redeemCodeTotal}
                setRedeemCodeQuery={setRedeemCodeQuery}
                setRedeemCodeStatus={setRedeemCodeStatus}
                setRedeemCodePage={setRedeemCodePage}
                openRedeemCodeEditor={openRedeemCodeEditor}
                patchRedeemCode={(id, input) => void patchRedeemCode(id, input)}
                deleteRedeemCode={(id) => void deleteRedeemCode(id)}
                onBatchCreated={() => loadAll('redeemCodes')}
              />
            )}
            {tab === 'billing' && (
              <BillingSection
                creditPackages={creditPackages}
                creditOrders={creditOrders}
                orderQuery={orderQuery}
                orderStatus={orderStatus}
                orderPage={orderPage}
                orderTotal={orderTotal}
                setOrderQuery={setOrderQuery}
                setOrderStatus={setOrderStatus}
                setOrderPage={setOrderPage}
                openPackageEditor={openCreditPackageEditor}
                patchPackage={(id, input) => void patchCreditPackage(id, input)}
                deletePackage={(id) => void deleteCreditPackage(id)}
                patchOrder={(id, input) => void patchCreditOrder(id, input)}
              />
            )}
            {tab === 'tickets' && (
              <TicketsSection
                tickets={supportTickets}
                ticketQuery={ticketQuery}
                ticketStatus={ticketStatus}
                ticketPriority={ticketPriority}
                ticketPage={ticketPage}
                ticketTotal={ticketTotal}
                setTicketQuery={setTicketQuery}
                setTicketStatus={setTicketStatus}
                setTicketPriority={setTicketPriority}
                setTicketPage={setTicketPage}
                setSelectedTicketId={setSelectedTicketId}
                patchTicket={(id, input) => void patchSupportTicket(id, input)}
              />
            )}
            {tab === 'moderation' && (
              <ModerationSection
                rules={moderationRules}
                query={moderationQuery}
                enabledFilter={moderationEnabledFilter}
                setQuery={setModerationQuery}
                setEnabledFilter={setModerationEnabledFilter}
                openEditor={openModerationRuleEditor}
                patchRule={(id, input) => void patchModerationRule(id, input)}
                deleteRule={(id) => void deleteModerationRule(id)}
              />
            )}
            {tab === 'tasks' && renderTasks()}
            {tab === 'models' && (
              <ModelsSection
                models={models}
                filteredModels={filteredModels}
                upstreams={upstreams}
                modelQuery={modelQuery}
                modelStatusFilter={modelStatusFilter}
                modelProviderFilter={modelProviderFilter}
                modelHealthFilter={modelHealthFilter}
                loading={loading}
                loadError={modelLoadError}
                selectedModelIds={selectedModelIds}
                modelBatchOperating={modelBatchOperating}
                setModelQuery={setModelQuery}
                setModelStatusFilter={setModelStatusFilter}
                setModelProviderFilter={setModelProviderFilter}
                setModelHealthFilter={setModelHealthFilter}
                setSelectedModelIds={setSelectedModelIds}
                toggleCurrentPageModels={toggleCurrentPageModels}
                toggleModelSelection={toggleModelSelection}
                batchPatchModels={(input) => void batchPatchModels(input)}
                openModelEditor={openModelEditor}
                patchModel={(modelId, input, successMessage) => void patchModel(modelId, input, successMessage)}
                deleteModelById={(modelId) => void deleteModelById(modelId)}
              />
            )}
            {tab === 'upstreams' && renderUpstreams()}
            {tab === 'square' && (
              <SquareSection
                squareConfig={squareConfig}
                squareConfigSaving={squareConfigSaving}
                squareR2Testing={squareR2Testing}
                squareR2TestResult={squareR2TestResult}
                squareUsage={squareUsage}
                squareShares={squareShares}
                squareTotal={squareTotal}
                squarePage={squarePage}
                squareQuery={squareQuery}
                squareStatus={squareStatus}
                squareKind={squareKind}
                pageSize={adminPageSize}
                selectedSquareShareIds={selectedSquareShareIds}
                squareBatchOperating={squareBatchOperating}
                setSquareQuery={setSquareQuery}
                setSquareStatus={setSquareStatus}
                setSquareKind={setSquareKind}
                setSquarePage={setSquarePage}
                setSelectedSquareShareIds={setSelectedSquareShareIds}
                setSelectedSquareShareId={setSelectedSquareShareId}
                toggleCurrentPageSquareShares={toggleCurrentPageSquareShares}
                toggleSquareShareSelection={toggleSquareShareSelection}
                saveSquareConfig={(input) => void saveSquareConfig(input)}
                testSquareR2={() => void testSquareR2()}
                batchUpdateSquareSharesStatus={(status) => void batchUpdateSquareSharesStatus(status)}
                updateSquareShareStatus={(shareId, status, successMessage) => void updateSquareShareStatus(shareId, status, successMessage)}
                cleanupSquareDryRun={() => void cleanupSquareDryRun()}
                cleanupSquareNow={() => void cleanupSquareNow()}
              />
            )}
            {tab === 'announcements' && renderAnnouncements()}
            {tab === 'settings' && renderSettings()}
            {tab === 'audit' && (
              <AuditSection
                auditLogs={auditLogs}
                auditTotal={auditTotal}
                auditPage={auditPage}
                pageSize={adminPageSize}
                auditQuery={auditQuery}
                auditAction={auditAction}
                auditFrom={auditFrom}
                auditTo={auditTo}
                setAuditQuery={setAuditQuery}
                setAuditAction={setAuditAction}
                setAuditFrom={setAuditFrom}
                setAuditTo={setAuditTo}
                setAuditPage={setAuditPage}
                setSelectedAuditLogId={setSelectedAuditLogId}
                onExport={() => void exportAuditLogs()}
              />
            )}
          </div>
        </main>
      </div>

      {renderUserDialog()}
      {renderLedgerDialog()}
      {renderTaskDialog()}
      {renderTicketDialog()}
      <LoginLogDialog loginLogs={loginLogs} selectedLoginLogId={selectedLoginLogId} setSelectedLoginLogId={setSelectedLoginLogId} />
      <AuditDialog auditLogs={auditLogs} selectedAuditLogId={selectedAuditLogId} setSelectedAuditLogId={setSelectedAuditLogId} />
      <SquareDialog
        squareShares={squareShares}
        selectedSquareShareId={selectedSquareShareId}
        setSelectedSquareShareId={setSelectedSquareShareId}
        updateSquareShareStatus={(shareId, status, successMessage, closeAfter) => void updateSquareShareStatus(shareId, status, successMessage, closeAfter)}
      />
      {renderAnnouncementPreviewDialog()}
      {renderEditorDrawer()}
    </div>
  )
}
