import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cx, navGroups, type AdminTab } from './shared'

type QuickEntry = {
  id: AdminTab
  label: string
  caption: string
  groupLabel: string
  keywords: string
}

const tabKeywords: Partial<Record<AdminTab, string>> = {
  overview: '看板 首页 指标 待办 dashboard overview',
  reports: '报表 趋势 统计 用量 成功率 report analytics',
  users: '用户 账号 会员 积分 余额 禁用 密码 user member account',
  loginLogs: '登录 日志 安全 IP 失败 login security',
  credits: '积分 流水 扣费 退款 credit ledger balance',
  redeemCodes: '兑换码 卡券 卡密 优惠码 批量 发码 redeem coupon code',
  billing: '套餐 订单 充值 支付 billing order package',
  tickets: '反馈 工单 客服 投诉 support ticket service',
  moderation: '风控 敏感词 审核 拦截 moderation keyword',
  square: '广场 图片 分享 审核 square gallery share',
  announcements: '公告 通知 运营消息 announcement notice',
  models: '模型 价格 消耗 生图 model price',
  upstreams: '上游 渠道 转发 API Key baseUrl upstream provider',
  tasks: '生成 日志 任务 失败 prompt generation task',
  settings: '设置 注册 维护 平台 setting config',
  audit: '审计 操作 管理员 audit log',
}

export function AdminQuickSwitch({
  activeTab,
  onSelect,
}: {
  activeTab: AdminTab
  onSelect: (tab: AdminTab) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const entries = useMemo<QuickEntry[]>(() => navGroups.flatMap((group) => group.items.map((item) => ({
    ...item,
    groupLabel: group.label,
    keywords: `${group.label} ${group.caption} ${item.label} ${item.caption} ${tabKeywords[item.id] ?? ''}`.toLowerCase(),
  }))), [])

  const results = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return entries
    const terms = text.split(/\s+/).filter(Boolean)
    return entries.filter((entry) => terms.every((term) => entry.keywords.includes(term)))
  }, [entries, query])

  const visibleResults = results.slice(0, 8)
  const selectedEntry = visibleResults[Math.min(activeIndex, Math.max(visibleResults.length - 1, 0))]

  function selectTab(id: AdminTab) {
    onSelect(id)
    setQuery('')
    setOpen(false)
    setActiveIndex(0)
    inputRef.current?.blur()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((value) => Math.min(value + 1, Math.max(visibleResults.length - 1, 0)))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((value) => Math.max(value - 1, 0))
    }
    if (event.key === 'Enter' && selectedEntry) {
      event.preventDefault()
      selectTab(selectedEntry.id)
    }
    if (event.key === 'Escape') {
      setOpen(false)
      setQuery('')
      setActiveIndex(0)
      inputRef.current?.blur()
    }
  }

  return (
    <div className="relative hidden w-full max-w-md lg:block">
      <div className={cx(
        'flex h-10 items-center gap-2 rounded-2xl border bg-gray-50 px-3 transition',
        open ? 'border-gray-300 bg-white shadow-sm dark:border-white/[0.14] dark:bg-gray-950' : 'border-gray-200 dark:border-white/[0.08] dark:bg-white/[0.04]',
      )}>
        <span className="text-sm text-gray-400">⌕</span>
        <input
          ref={inputRef}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder="搜索后台功能、配置、日志..."
          className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
        />
        <span className="rounded-lg border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 dark:border-white/[0.08] dark:bg-white/[0.04]">Enter</span>
      </div>

      {open && (
        <>
          <button type="button" aria-label="关闭快速跳转" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-12 z-20 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-950/10 dark:border-white/[0.08] dark:bg-gray-900">
            <div className="max-h-[410px] overflow-y-auto p-2">
              {visibleResults.map((entry, index) => (
                <button
                  key={entry.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectTab(entry.id)}
                  className={cx(
                    'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition',
                    index === activeIndex ? 'bg-slate-950 text-white dark:bg-white dark:text-gray-950' : 'hover:bg-gray-50 dark:hover:bg-white/[0.06]',
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{entry.label}</span>
                      {entry.id === activeTab && <span className={cx('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', index === activeIndex ? 'bg-white/15 text-white dark:bg-gray-950/10 dark:text-gray-600' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300')}>当前</span>}
                    </span>
                    <span className={cx('mt-0.5 block truncate text-xs', index === activeIndex ? 'text-white/65 dark:text-gray-500' : 'text-gray-400')}>{entry.caption}</span>
                  </span>
                  <span className={cx('shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold', index === activeIndex ? 'bg-white/15 text-white/80 dark:bg-gray-950/10 dark:text-gray-500' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400')}>{entry.groupLabel}</span>
                </button>
              ))}
              {!visibleResults.length && (
                <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/[0.08]">
                  没有匹配的后台功能
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-[11px] text-gray-400 dark:border-white/[0.08]">
              <span>↑↓ 选择，Enter 跳转</span>
              <span>{results.length} 个匹配</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
