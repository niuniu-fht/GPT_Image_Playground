import { useEffect, useRef, useState, type FormEvent } from 'react'
import { platformApi } from '../../lib/platformApi'
import { useStore } from '../../store'
import { ThemeToggle } from '../../shared/components'
import type { CreditOrder, CreditPackage, SupportTicket } from '../../types'
import {
  ChangePasswordDialog,
  type ChangePasswordDraft,
  type ChangePasswordErrors,
} from './header/ChangePasswordDialog'
import { FeedbackDialog, type FeedbackDraft } from './header/FeedbackDialog'
import { HeaderAccountActions } from './header/HeaderAccountActions'
import { HeaderProductNav } from './header/HeaderProductNav'
import { RedeemCreditsDialog } from './header/RedeemCreditsDialog'
import { TopupCreditsDialog } from './header/TopupCreditsDialog'

function createEmptyFeedbackDraft(): FeedbackDraft {
  return {
    category: 'general',
    priority: 'normal',
    title: '',
    content: '',
    contact: '',
  }
}

function createEmptyPasswordDraft(): ChangePasswordDraft {
  return {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  }
}

function validatePasswordDraft(draft: ChangePasswordDraft): ChangePasswordErrors {
  const errors: ChangePasswordErrors = {}
  if (!draft.currentPassword) {
    errors.currentPassword = '请输入当前密码'
  }
  if (!draft.newPassword) {
    errors.newPassword = '请输入新密码'
  } else if (draft.newPassword.length < 8) {
    errors.newPassword = '新密码至少 8 位'
  } else if (draft.newPassword === draft.currentPassword) {
    errors.newPassword = '新密码不能和当前密码相同'
  }
  if (!draft.confirmPassword) {
    errors.confirmPassword = '请再次输入新密码'
  } else if (draft.confirmPassword !== draft.newPassword) {
    errors.confirmPassword = '两次输入的新密码不一致'
  }
  return errors
}

const defaultRedeemDescription = '活动码和客服补偿码会立即到账，并写入积分流水。'
const openSourceRepoUrl = 'https://github.com/CookSleep/gpt_image_playground'

function OpenSourceRepoLink() {
  return (
    <a
      href={openSourceRepoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="hidden h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200 dark:hover:border-white/15 dark:hover:bg-white/[0.08] sm:inline-flex"
      aria-label="GitHub 开源项目"
      title="GitHub 开源项目"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    </a>
  )
}

export default function Header() {
  const appView = useStore((s) => s.appView)
  const setAppView = useStore((s) => s.setAppView)
  const currentUser = useStore((s) => s.currentUser)
  const openAuthModal = useStore((s) => s.openAuthModal)
  const setCurrentUser = useStore((s) => s.setCurrentUser)
  const setShowAdminModels = useStore((s) => s.setShowAdminModels)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const showToast = useStore((s) => s.showToast)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const redeemRequestRef = useRef<{ code: string; requestId: string } | null>(null)
  const [topupOpen, setTopupOpen] = useState(false)
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [orders, setOrders] = useState<CreditOrder[]>([])
  const [topupLoading, setTopupLoading] = useState(false)
  const [creatingOrderId, setCreatingOrderId] = useState<string | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackTickets, setFeedbackTickets] = useState<SupportTicket[]>([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackDraft, setFeedbackDraft] = useState<FeedbackDraft>(() => createEmptyFeedbackDraft())
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [changePasswordDraft, setChangePasswordDraft] = useState<ChangePasswordDraft>(() => createEmptyPasswordDraft())
  const [changePasswordErrors, setChangePasswordErrors] = useState<ChangePasswordErrors>({})
  const [changePasswordSubmitting, setChangePasswordSubmitting] = useState(false)
  const [redeemDescription, setRedeemDescription] = useState(defaultRedeemDescription)

  async function refreshPublicSettings() {
    try {
      const result = await platformApi.getPublicSettings()
      setRedeemDescription(result.redeemDescription ?? '')
    } catch (error) {
      console.warn('[settings] failed to load redeem description', error)
    }
  }

  useEffect(() => {
    let cancelled = false
    platformApi.getPublicSettings()
      .then((result) => {
        if (!cancelled) setRedeemDescription(result.redeemDescription ?? '')
      })
      .catch((error) => {
        console.warn('[settings] failed to load redeem description', error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function openRedeemDialog() {
    setRedeemOpen(true)
    void refreshPublicSettings()
  }

  async function handleLogout() {
    setConfirmDialog({
      title: '退出当前账号？',
      message: '退出后需要重新登录才能继续生成图片、管理作品和查看订单。',
      confirmText: '退出登录',
      action: async () => {
        try {
          await platformApi.logout()
          setCurrentUser(null)
          setAppView('home')
          showToast('已退出登录', 'info')
        } catch (error) {
          showToast(error instanceof Error ? error.message : '退出失败，请稍后重试', 'error')
          throw error
        }
      },
    })
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
    const normalizedCode = code.toUpperCase()
    if (redeemRequestRef.current?.code !== normalizedCode) {
      redeemRequestRef.current = { code: normalizedCode, requestId: crypto.randomUUID() }
    }
    setRedeeming(true)
    try {
      const result = await platformApi.redeemCredits({
        code,
        requestId: redeemRequestRef.current.requestId,
      })
      setCurrentUser(result.user)
      redeemRequestRef.current = null
      setRedeemCode('')
      setRedeemOpen(false)
      showToast(`兑换成功，获得 ${result.redeemCode.credits} 积分`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '兑换失败', 'error')
    } finally {
      setRedeeming(false)
    }
  }

  async function openTopup() {
    if (!currentUser) {
      openAuthModal('login')
      return
    }
    setTopupOpen(true)
    setTopupLoading(true)
    try {
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
      await platformApi.createSupportTicket(feedbackDraft)
      const result = await platformApi.listSupportTickets()
      setFeedbackTickets(result.items)
      setFeedbackDraft(createEmptyFeedbackDraft())
      showToast('反馈已提交，管理员会在后台处理', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '反馈提交失败', 'error')
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  function openChangePassword() {
    if (!currentUser) {
      openAuthModal('login')
      return
    }
    setChangePasswordDraft(createEmptyPasswordDraft())
    setChangePasswordErrors({})
    setChangePasswordOpen(true)
  }

  async function submitChangePassword(event: FormEvent) {
    event.preventDefault()
    const nextErrors = validatePasswordDraft(changePasswordDraft)
    setChangePasswordErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setChangePasswordSubmitting(true)
    try {
      await platformApi.changePassword({
        currentPassword: changePasswordDraft.currentPassword,
        newPassword: changePasswordDraft.newPassword,
      })
      setChangePasswordOpen(false)
      setChangePasswordDraft(createEmptyPasswordDraft())
      showToast('密码已更新', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '密码修改失败，请稍后重试'
      setChangePasswordErrors((prev) => ({ ...prev, form: message }))
      showToast(message, 'error')
    } finally {
      setChangePasswordSubmitting(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-white/[0.08] dark:bg-gray-950/80">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <HeaderProductNav appView={appView} setAppView={setAppView} />
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {appView === 'local' && <OpenSourceRepoLink />}
            <ThemeToggle />
            <HeaderAccountActions
              currentUser={currentUser}
              onAdmin={openAdminConsole}
              onChangePassword={openChangePassword}
              onFeedback={() => void openFeedback()}
              onLogin={() => openAuthModal('login')}
              onLogout={() => void handleLogout()}
              onRedeem={openRedeemDialog}
            />
          </div>
        </div>
      </header>

      {redeemOpen && currentUser && (
        <RedeemCreditsDialog
          currentUser={currentUser}
          description={redeemDescription}
          redeemCode={redeemCode}
          redeeming={redeeming}
          onChangeRedeemCode={setRedeemCode}
          onClose={() => setRedeemOpen(false)}
          onSubmit={(event) => void submitRedeem(event)}
        />
      )}

      {topupOpen && currentUser && (
        <TopupCreditsDialog
          currentUser={currentUser}
          creatingOrderId={creatingOrderId}
          loading={topupLoading}
          orders={orders}
          packages={packages}
          onClose={() => setTopupOpen(false)}
          onCreateOrder={(packageId) => void createOrder(packageId)}
        />
      )}

      {feedbackOpen && currentUser && (
        <FeedbackDialog
          currentUser={currentUser}
          draft={feedbackDraft}
          loading={feedbackLoading}
          submitting={feedbackSubmitting}
          tickets={feedbackTickets}
          onClose={() => setFeedbackOpen(false)}
          onDraftChange={setFeedbackDraft}
          onSubmit={(event) => void submitFeedback(event)}
        />
      )}

      {changePasswordOpen && currentUser && (
        <ChangePasswordDialog
          draft={changePasswordDraft}
          errors={changePasswordErrors}
          submitting={changePasswordSubmitting}
          onChange={setChangePasswordDraft}
          onClearError={(field) => setChangePasswordErrors((prev) => ({ ...prev, [field]: undefined }))}
          onClose={() => {
            if (!changePasswordSubmitting) setChangePasswordOpen(false)
          }}
          onSubmit={(event) => void submitChangePassword(event)}
        />
      )}
    </>
  )
}
