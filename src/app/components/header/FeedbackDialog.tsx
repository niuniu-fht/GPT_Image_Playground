import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { CurrentUser, SupportTicket } from '../../../types'

export interface FeedbackDraft {
  category: SupportTicket['category']
  priority: SupportTicket['priority']
  title: string
  content: string
  contact: string
}

interface FeedbackDialogProps {
  currentUser: CurrentUser
  draft: FeedbackDraft
  loading: boolean
  submitting: boolean
  tickets: SupportTicket[]
  onClose: () => void
  onDraftChange: Dispatch<SetStateAction<FeedbackDraft>>
  onSubmit: (event: FormEvent) => void
}

function ticketStatusLabel(status: SupportTicket['status']) {
  if (status === 'resolved') return '已解决'
  if (status === 'closed') return '已关闭'
  if (status === 'in_progress') return '处理中'
  return '待处理'
}

export function FeedbackDialog({
  draft,
  loading,
  submitting,
  tickets,
  onClose,
  onDraftChange,
  onSubmit,
}: FeedbackDialogProps) {
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-gray-950/35 px-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl shadow-gray-950/15 dark:border-white/[0.08] dark:bg-gray-900">
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-5 dark:border-white/[0.08] dark:bg-white/[0.04]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-blue-600">用户反馈</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">提交问题给管理员</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">生成失败、订单积分、广场内容和账号问题都可以在这里反馈。</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[1fr_0.9fr]">
          <form onSubmit={onSubmit} className="space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-gray-500">
                问题分类
                <select value={draft.category} onChange={(event) => onDraftChange((prev) => ({ ...prev, category: event.target.value as SupportTicket['category'] }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950">
                  <option value="general">通用反馈</option>
                  <option value="generation">生成问题</option>
                  <option value="billing">订单积分</option>
                  <option value="square">广场内容</option>
                  <option value="account">账号权限</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-500">
                优先级
                <select value={draft.priority} onChange={(event) => onDraftChange((prev) => ({ ...prev, priority: event.target.value as SupportTicket['priority'] }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950">
                  <option value="normal">普通</option>
                  <option value="high">高</option>
                  <option value="urgent">紧急</option>
                  <option value="low">低</option>
                </select>
              </label>
            </div>
            <label className="block text-xs font-semibold text-gray-500">
              标题
              <input value={draft.title} onChange={(event) => onDraftChange((prev) => ({ ...prev, title: event.target.value }))} placeholder="简单描述问题" className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950" />
            </label>
            <label className="block text-xs font-semibold text-gray-500">
              详细说明
              <textarea value={draft.content} onChange={(event) => onDraftChange((prev) => ({ ...prev, content: event.target.value }))} rows={7} placeholder="请说明发生了什么、期望结果、相关订单号或任务信息" className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950" />
            </label>
            <label className="block text-xs font-semibold text-gray-500">
              联系方式
              <input value={draft.contact} onChange={(event) => onDraftChange((prev) => ({ ...prev, contact: event.target.value }))} placeholder="微信、邮箱或手机号，可选" className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950" />
            </label>
            <button disabled={submitting || !draft.title.trim() || !draft.content.trim()} className="h-10 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950">
              {submitting ? '提交中...' : '提交反馈'}
            </button>
          </form>
          <div className="min-h-0 overflow-y-auto border-t border-gray-100 px-6 py-5 dark:border-white/[0.08] lg:border-l lg:border-t-0">
            <div className="mb-3 text-sm font-semibold text-gray-950 dark:text-gray-50">我的反馈记录</div>
            {loading ? (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/[0.08]">正在加载...</div>
            ) : (
              <div className="space-y-3">
                {tickets.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-gray-200 p-3 text-sm dark:border-white/[0.08]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{item.title}</div>
                        <div className="mt-1 text-xs text-gray-500">{new Date(item.updatedAt).toLocaleString()}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-white/[0.08] dark:text-gray-300">
                        {ticketStatusLabel(item.status)}
                      </span>
                    </div>
                    {item.adminReply && <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700 dark:bg-blue-300/10 dark:text-blue-200">{item.adminReply}</div>}
                  </div>
                ))}
                {!tickets.length && <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/[0.08]">暂无反馈记录</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

