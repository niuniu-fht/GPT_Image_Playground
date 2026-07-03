import { useState, type FormEvent } from 'react'
import { useStore } from '../../store'
import type { CreditOrder, CreditPackage, SupportTicket } from '../../types'

export default function Header() {
  const appView = useStore((s) => s.appView)
  const setAppView = useStore((s) => s.setAppView)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const setShowPromptLibrary = useStore((s) => s.setShowPromptLibrary)
  const currentUser = useStore((s) => s.currentUser)
  const openAuthModal = useStore((s) => s.openAuthModal)
  const setCurrentUser = useStore((s) => s.setCurrentUser)
  const setShowAdminModels = useStore((s) => s.setShowAdminModels)
  const showToast = useStore((s) => s.showToast)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [topupOpen, setTopupOpen] = useState(false)
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [orders, setOrders] = useState<CreditOrder[]>([])
  const [topupLoading, setTopupLoading] = useState(false)
  const [creatingOrderId, setCreatingOrderId] = useState<string | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackTickets, setFeedbackTickets] = useState<SupportTicket[]>([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackDraft, setFeedbackDraft] = useState({
    category: 'general' as SupportTicket['category'],
    priority: 'normal' as SupportTicket['priority'],
    title: '',
    content: '',
    contact: '',
  })

  async function handleLogout() {
    const { platformApi } = await import('../../lib/platformApi')
    await platformApi.logout()
    setCurrentUser(null)
    showToast('已退出登录', 'info')
  }

  function openAdminConsole() {
    if (window.location.pathname !== '/admin') {
      window.history.pushState(null, '', '/admin')
    }
    setShowAdminModels(true)
  }

  async function submitRedeem(event: FormEvent) {
    event.preventDefault()
    const code = redeemCode.trim()
    if (!code) return
    setRedeeming(true)
    try {
      const { platformApi } = await import('../../lib/platformApi')
      const result = await platformApi.redeemCredits({ code })
      setCurrentUser(result.user)
      setRedeemCode('')
      setRedeemOpen(false)
      showToast(`兑换成功，获得 ${result.redeemCode.credits} 积分`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '兑换失败', 'error')
    } finally {
      setRedeeming(false)
    }
  }

  function formatMoney(cents: number, currency: string) {
    const symbol = currency === 'CNY' ? '¥' : `${currency} `
    return `${symbol}${(cents / 100).toFixed(2)}`
  }

  async function openTopup() {
    if (!currentUser) {
      openAuthModal('login')
      return
    }
    setTopupOpen(true)
    setTopupLoading(true)
    try {
      const { platformApi } = await import('../../lib/platformApi')
      const [packageResult, orderResult] = await Promise.all([
        platformApi.listCreditPackages(),
        platformApi.listCreditOrders(),
      ])
      setPackages(packageResult.items)
      setOrders(orderResult.items)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '套餐加载失败', 'error')
    } finally {
      setTopupLoading(false)
    }
  }

  async function createOrder(packageId: string) {
    setCreatingOrderId(packageId)
    try {
      const { platformApi } = await import('../../lib/platformApi')
      const result = await platformApi.createCreditOrder({ packageId, userNote: '前台提交充值订单' })
      const orderResult = await platformApi.listCreditOrders()
      setOrders(orderResult.items)
      showToast(`订单 ${result.order.orderNo} 已提交，等待管理员确认`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '订单提交失败', 'error')
    } finally {
      setCreatingOrderId(null)
    }
  }

  async function openFeedback() {
    if (!currentUser) {
      openAuthModal('login')
      return
    }
    setFeedbackOpen(true)
    setFeedbackLoading(true)
    try {
      const { platformApi } = await import('../../lib/platformApi')
      const result = await platformApi.listSupportTickets()
      setFeedbackTickets(result.items)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '反馈记录加载失败', 'error')
    } finally {
      setFeedbackLoading(false)
    }
  }

  async function submitFeedback(event: FormEvent) {
    event.preventDefault()
    if (!feedbackDraft.title.trim() || !feedbackDraft.content.trim()) return
    setFeedbackSubmitting(true)
    try {
      const { platformApi } = await import('../../lib/platformApi')
      await platformApi.createSupportTicket(feedbackDraft)
      const result = await platformApi.listSupportTickets()
      setFeedbackTickets(result.items)
      setFeedbackDraft({ category: 'general', priority: 'normal', title: '', content: '', contact: '' })
      showToast('反馈已提交，管理员会在后台处理', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '反馈提交失败', 'error')
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  return (
    <>
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-white/[0.08]">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-3 px-4">
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-tight text-gray-800 dark:text-gray-100 sm:text-base">
          GPT Image Playground
        </h1>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <div className="hidden rounded-full border border-gray-200/80 bg-white/90 p-0.5 shadow-sm dark:border-white/[0.08] dark:bg-gray-900/90 sm:inline-flex">
            <button
              type="button"
              onClick={() => setAppView('local')}
              className={`h-7 rounded-full px-3 text-xs font-medium transition ${
                appView === 'local'
                  ? 'bg-blue-500 text-white shadow-[0_10px_20px_-14px_rgba(37,99,235,0.9)]'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]'
              }`}
            >
              本地
            </button>
            <button
              type="button"
              onClick={() => setAppView('square')}
              className={`h-7 rounded-full px-3 text-xs font-medium transition ${
                appView === 'square'
                  ? 'bg-blue-500 text-white shadow-[0_10px_20px_-14px_rgba(37,99,235,0.9)]'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]'
              }`}
            >
              广场
            </button>
          </div>
          <button
            type="button"
            onClick={() => setAppView(appView === 'square' ? 'local' : 'square')}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200/80 bg-white/90 shadow-sm transition-colors sm:hidden dark:border-white/[0.08] dark:bg-gray-900/90 ${
              appView === 'square'
                ? 'text-blue-500 dark:text-blue-300'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]'
            }`}
            title={appView === 'square' ? '返回本地画廊' : '打开广场'}
            aria-label={appView === 'square' ? '返回本地画廊' : '打开广场'}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.5 6.75h15M4.5 12h15M4.5 17.25h15" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 4.5c1.15 2.1 1.72 4.6 1.72 7.5S9.15 17.4 8 19.5M16 4.5c-1.15 2.1-1.72 4.6-1.72 7.5s.57 5.4 1.72 7.5" />
            </svg>
          </button>
          <button
            onClick={() => setShowPromptLibrary(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200/80 bg-white/90 text-gray-600 shadow-sm transition-colors hover:bg-gray-100 dark:border-white/[0.08] dark:bg-gray-900/90 dark:text-gray-300 dark:hover:bg-white/[0.06]"
            title="提示词库"
            aria-label="打开提示词库"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M6.75 5.75h7.5a3 3 0 0 1 3 3v8.5a1 1 0 0 1-1.6.8l-2.55-1.9a2 2 0 0 0-2.4 0l-2.55 1.9a1 1 0 0 1-1.6-.8v-8.5a3 3 0 0 1 3-3Z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.75 10h4.5M8.75 12.75h3.25" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="m15.75 5.25.42 1.12 1.11.42-1.11.42-.42 1.11-.42-1.11-1.11-.42 1.11-.42.42-1.12Z"
              />
            </svg>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200/80 bg-white/90 text-gray-600 shadow-sm transition-colors hover:bg-gray-100 dark:border-white/[0.08] dark:bg-gray-900/90 dark:text-gray-300 dark:hover:bg-white/[0.06]"
            title="设置"
            aria-label="打开设置"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
          {currentUser && (
            <button
              type="button"
              onClick={() => void openFeedback()}
              className="inline-flex h-8 items-center rounded-full border border-gray-200/80 bg-white/90 px-2.5 text-xs font-medium text-gray-600 shadow-sm transition hover:bg-gray-100 dark:border-white/[0.08] dark:bg-gray-900/90 dark:text-gray-300 dark:hover:bg-white/[0.06]"
            >
              反馈
            </button>
          )}
          {currentUser ? (
            <div className="ml-1 flex items-center gap-1.5">
              <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 sm:inline-flex dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200">
                ✨ {currentUser.creditBalance}
              </span>
              <button
                type="button"
                onClick={() => setRedeemOpen(true)}
                className="inline-flex h-8 items-center rounded-full border border-amber-200 bg-white px-2.5 text-xs font-semibold text-amber-700 shadow-sm transition hover:bg-amber-50 dark:border-amber-300/20 dark:bg-gray-900/90 dark:text-amber-200 dark:hover:bg-amber-300/10 sm:px-3"
              >
                <span className="sm:hidden">兑</span>
                <span className="hidden sm:inline">兑换</span>
              </button>
              <button
                type="button"
                onClick={() => void openTopup()}
                className="inline-flex h-8 items-center rounded-full bg-slate-950 px-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-gray-950 sm:px-3"
              >
                <span className="sm:hidden">充</span>
                <span className="hidden sm:inline">充值</span>
              </button>
              {currentUser.role === 'admin' && (
                <button
                  type="button"
                  onClick={openAdminConsole}
                  className="inline-flex h-8 items-center rounded-full border border-gray-200/80 bg-white/90 px-3 text-xs font-medium text-gray-600 shadow-sm transition hover:bg-gray-100 dark:border-white/[0.08] dark:bg-gray-900/90 dark:text-gray-300 dark:hover:bg-white/[0.06]"
                >
                  <span className="sm:hidden">后台</span>
                  <span className="hidden sm:inline">运营后台</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleLogout()}
                title={currentUser.email}
                className="inline-flex h-8 max-w-[150px] items-center gap-2 rounded-full border border-gray-200/80 bg-white/90 px-2.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-100 dark:border-white/[0.08] dark:bg-gray-900/90 dark:text-gray-200 dark:hover:bg-white/[0.06]"
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white dark:bg-white dark:text-gray-950">
                  {currentUser.email.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden truncate sm:block">{currentUser.email}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="ml-1 inline-flex h-8 items-center rounded-full bg-slate-950 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-gray-950"
            >
              登录
            </button>
          )}
        </div>
      </div>
    </header>
    {redeemOpen && currentUser && (
      <div className="fixed inset-0 z-[95] grid place-items-center bg-gray-950/35 px-4 backdrop-blur-sm">
        <form onSubmit={submitRedeem} className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl shadow-gray-950/15 dark:border-white/[0.08] dark:bg-gray-900">
          <div className="border-b border-gray-100 bg-gray-50 px-6 py-5 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-amber-600">积分兑换</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">输入兑换码领取积分</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">活动码和客服补偿码会立即到账，并写入积分流水。</p>
              </div>
              <button type="button" onClick={() => setRedeemOpen(false)} className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
            </div>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-300/15 dark:bg-amber-300/10 dark:text-amber-100">
              当前余额 <span className="font-semibold">{currentUser.creditBalance}</span> 积分
            </div>
            <label className="block text-xs font-semibold text-gray-500">
              兑换码
              <input
                value={redeemCode}
                onChange={(event) => setRedeemCode(event.target.value.toUpperCase())}
                placeholder="例如 SUMMER100"
                className="mt-1.5 h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 font-mono text-sm font-semibold tracking-wide text-gray-900 outline-none transition focus:border-amber-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                autoFocus
              />
            </label>
          </div>
          <div className="flex gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <button type="button" onClick={() => setRedeemOpen(false)} className="h-10 flex-1 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white dark:border-white/[0.08] dark:text-gray-200 dark:hover:bg-white/[0.06]">取消</button>
            <button disabled={redeeming || !redeemCode.trim()} className="h-10 flex-1 rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950">
              {redeeming ? '兑换中...' : '确认兑换'}
            </button>
          </div>
        </form>
      </div>
    )}
    {topupOpen && currentUser && (
      <div className="fixed inset-0 z-[95] grid place-items-center bg-gray-950/35 px-4 backdrop-blur-sm">
        <div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl shadow-gray-950/15 dark:border-white/[0.08] dark:bg-gray-900">
          <div className="border-b border-gray-100 bg-gray-50 px-6 py-5 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-blue-600">积分充值</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">选择套餐提交订单</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">第一版采用人工确认到账；管理员确认后积分自动加入余额。</p>
              </div>
              <button type="button" onClick={() => setTopupOpen(false)} className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-300/15 dark:bg-amber-300/10 dark:text-amber-100">
              当前余额 <span className="font-semibold">{currentUser.creditBalance}</span> 积分
            </div>
            {topupLoading ? (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-white/[0.08]">正在加载套餐...</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {packages.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
                    <div className="flex min-h-[54px] items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-gray-950 dark:text-gray-50">{item.name}</div>
                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{item.description}</div>
                      </div>
                      {item.badge && <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-300/10 dark:text-blue-200">{item.badge}</span>}
                    </div>
                    <div className="mt-5 text-3xl font-bold tracking-tight">{item.credits + item.bonusCredits}</div>
                    <div className="mt-1 text-xs text-gray-500">{item.credits} 基础积分 + {item.bonusCredits} 赠送</div>
                    <div className="mt-5 flex items-center justify-between">
                      <div className="text-lg font-semibold text-gray-950 dark:text-gray-50">{formatMoney(item.priceCents, item.currency)}</div>
                      <button
                        type="button"
                        disabled={creatingOrderId === item.id}
                        onClick={() => void createOrder(item.id)}
                        className="h-9 rounded-xl bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-950"
                      >
                        {creatingOrderId === item.id ? '提交中' : '提交订单'}
                      </button>
                    </div>
                  </div>
                ))}
                {!packages.length && <div className="md:col-span-3 rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-white/[0.08]">暂无上架套餐</div>}
              </div>
            )}
            <div className="mt-6">
              <div className="mb-3 text-sm font-semibold text-gray-950 dark:text-gray-50">最近订单</div>
              <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/[0.08]">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-gray-100 px-4 py-3 text-sm last:border-0 dark:border-white/[0.06]">
                    <div className="min-w-0">
                      <div className="truncate font-mono font-semibold">{order.orderNo}</div>
                      <div className="mt-0.5 truncate text-xs text-gray-500">{order.packageName} · {order.totalCredits} 积分 · {new Date(order.createdAt).toLocaleString()}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${order.status === 'paid' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-300/10 dark:text-emerald-200' : order.status === 'cancelled' ? 'bg-gray-100 text-gray-500 dark:bg-white/[0.06]' : 'bg-amber-50 text-amber-700 dark:bg-amber-300/10 dark:text-amber-200'}`}>
                      {order.status === 'paid' ? '已到账' : order.status === 'cancelled' ? '已取消' : '待确认'}
                    </span>
                  </div>
                ))}
                {!orders.length && <div className="px-4 py-8 text-center text-sm text-gray-500">暂无订单</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    {feedbackOpen && currentUser && (
      <div className="fixed inset-0 z-[95] grid place-items-center bg-gray-950/35 px-4 backdrop-blur-sm">
        <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl shadow-gray-950/15 dark:border-white/[0.08] dark:bg-gray-900">
          <div className="border-b border-gray-100 bg-gray-50 px-6 py-5 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-blue-600">用户反馈</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">提交问题给管理员</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">生成失败、订单积分、广场内容和账号问题都可以在这里反馈。</p>
              </div>
              <button type="button" onClick={() => setFeedbackOpen(false)} className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
            </div>
          </div>
          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[1fr_0.9fr]">
            <form onSubmit={submitFeedback} className="space-y-4 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-gray-500">
                  问题分类
                  <select value={feedbackDraft.category} onChange={(event) => setFeedbackDraft((prev) => ({ ...prev, category: event.target.value as SupportTicket['category'] }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950">
                    <option value="general">通用反馈</option>
                    <option value="generation">生成问题</option>
                    <option value="billing">订单积分</option>
                    <option value="square">广场内容</option>
                    <option value="account">账号权限</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-gray-500">
                  优先级
                  <select value={feedbackDraft.priority} onChange={(event) => setFeedbackDraft((prev) => ({ ...prev, priority: event.target.value as SupportTicket['priority'] }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950">
                    <option value="normal">普通</option>
                    <option value="high">高</option>
                    <option value="urgent">紧急</option>
                    <option value="low">低</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-gray-500">
                标题
                <input value={feedbackDraft.title} onChange={(event) => setFeedbackDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="简单描述问题" className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950" />
              </label>
              <label className="block text-xs font-semibold text-gray-500">
                详细说明
                <textarea value={feedbackDraft.content} onChange={(event) => setFeedbackDraft((prev) => ({ ...prev, content: event.target.value }))} rows={7} placeholder="请说明发生了什么、期望结果、相关订单号或任务信息" className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950" />
              </label>
              <label className="block text-xs font-semibold text-gray-500">
                联系方式
                <input value={feedbackDraft.contact} onChange={(event) => setFeedbackDraft((prev) => ({ ...prev, contact: event.target.value }))} placeholder="微信、邮箱或手机号，可选" className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950" />
              </label>
              <button disabled={feedbackSubmitting || !feedbackDraft.title.trim() || !feedbackDraft.content.trim()} className="h-10 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950">
                {feedbackSubmitting ? '提交中...' : '提交反馈'}
              </button>
            </form>
            <div className="min-h-0 overflow-y-auto border-t border-gray-100 px-6 py-5 dark:border-white/[0.08] lg:border-l lg:border-t-0">
              <div className="mb-3 text-sm font-semibold text-gray-950 dark:text-gray-50">我的反馈记录</div>
              {feedbackLoading ? (
                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/[0.08]">正在加载...</div>
              ) : (
                <div className="space-y-3">
                  {feedbackTickets.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-gray-200 p-3 text-sm dark:border-white/[0.08]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{item.title}</div>
                          <div className="mt-1 text-xs text-gray-500">{new Date(item.updatedAt).toLocaleString()}</div>
                        </div>
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-white/[0.08] dark:text-gray-300">
                          {item.status === 'resolved' ? '已解决' : item.status === 'closed' ? '已关闭' : item.status === 'in_progress' ? '处理中' : '待处理'}
                        </span>
                      </div>
                      {item.adminReply && <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700 dark:bg-blue-300/10 dark:text-blue-200">{item.adminReply}</div>}
                    </div>
                  ))}
                  {!feedbackTickets.length && <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/[0.08]">暂无反馈记录</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
