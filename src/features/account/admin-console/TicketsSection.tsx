import type { SupportTicket } from '../../../types'
import { EmptyState, formatTime, PaginationBar, SectionShell, StatusBadge, ticketCategoryLabel, ticketPriorityLabel, ticketStatusLabel } from './shared'

function statusTone(status: SupportTicket['status']) {
  if (status === 'resolved') return 'green'
  if (status === 'closed') return 'gray'
  if (status === 'in_progress') return 'blue'
  return 'amber'
}

function priorityTone(priority: SupportTicket['priority']) {
  if (priority === 'urgent') return 'red'
  if (priority === 'high') return 'amber'
  if (priority === 'low') return 'gray'
  return 'blue'
}

type TicketsSectionProps = {
  tickets: SupportTicket[]
  ticketQuery: string
  ticketStatus: string
  ticketPriority: string
  ticketPage: number
  ticketTotal: number
  setTicketQuery: (value: string) => void
  setTicketStatus: (value: string) => void
  setTicketPriority: (value: string) => void
  setTicketPage: (value: number) => void
  setSelectedTicketId: (id: string | null) => void
  patchTicket: (id: string, input: Partial<Pick<SupportTicket, 'status' | 'priority' | 'adminReply' | 'adminNote'>>) => void
}

export function TicketsSection({
  tickets,
  ticketQuery,
  ticketStatus,
  ticketPriority,
  ticketPage,
  ticketTotal,
  setTicketQuery,
  setTicketStatus,
  setTicketPriority,
  setTicketPage,
  setSelectedTicketId,
  patchTicket,
}: TicketsSectionProps) {
  const openCount = tickets.filter((item) => item.status === 'open').length
  const urgentCount = tickets.filter((item) => item.priority === 'urgent').length
  return (
    <SectionShell title="反馈工单" description="统一处理用户反馈、生成失败、订单积分和广场投诉，避免问题散落在聊天记录里。">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="text-xs font-medium text-gray-400">当前页待处理</div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{openCount}</div>
          <div className="mt-1 text-xs text-gray-500">建议优先处理</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="text-xs font-medium text-gray-400">紧急工单</div>
          <div className="mt-2 text-2xl font-bold text-rose-600">{urgentCount}</div>
          <div className="mt-1 text-xs text-gray-500">通常关联支付或阻断使用</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="text-xs font-medium text-gray-400">当前页总量</div>
          <div className="mt-2 text-2xl font-bold">{tickets.length}</div>
          <div className="mt-1 text-xs text-gray-500">按更新时间排序</div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03] lg:flex-row">
        <input value={ticketQuery} onChange={(event) => setTicketQuery(event.target.value)} placeholder="搜索标题、内容、用户、任务 ID、订单号" className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950" />
        <select value={ticketStatus} onChange={(event) => setTicketStatus(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-white/[0.08] dark:bg-gray-950">
          <option value="all">全部状态</option>
          <option value="open">待处理</option>
          <option value="in_progress">处理中</option>
          <option value="resolved">已解决</option>
          <option value="closed">已关闭</option>
        </select>
        <select value={ticketPriority} onChange={(event) => setTicketPriority(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-white/[0.08] dark:bg-gray-950">
          <option value="all">全部优先级</option>
          <option value="urgent">紧急</option>
          <option value="high">高</option>
          <option value="normal">普通</option>
          <option value="low">低</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="overflow-x-auto">
          <div className="min-w-[1120px]">
            <div className="grid grid-cols-[1.3fr_1.2fr_0.9fr_0.9fr_1fr_1.2fr_1.1fr] gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-white/[0.04]">
              <span>问题</span><span>用户</span><span>分类</span><span>优先级</span><span>状态</span><span>关联</span><span className="text-right">操作</span>
            </div>
            {tickets.map((item) => (
              <div key={item.id} className="grid grid-cols-[1.3fr_1.2fr_0.9fr_0.9fr_1fr_1.2fr_1.1fr] items-center gap-4 border-b border-gray-100 px-4 py-3 text-sm last:border-0 dark:border-white/[0.06]">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{item.title}</div>
                  <div className="mt-0.5 line-clamp-1 text-xs text-gray-500">{item.content}</div>
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{item.user?.email ?? item.userId}</div>
                  <div className="truncate text-xs text-gray-400">{item.contact || '无联系方式'}</div>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-300">{ticketCategoryLabel(item.category)}</span>
                <StatusBadge tone={priorityTone(item.priority)}>{ticketPriorityLabel(item.priority)}</StatusBadge>
                <StatusBadge tone={statusTone(item.status)}>{ticketStatusLabel(item.status)}</StatusBadge>
                <div className="min-w-0 text-xs text-gray-500">
                  <div className="truncate">{item.relatedTaskId ? `任务 ${item.relatedTaskId}` : item.relatedOrderNo ? `订单 ${item.relatedOrderNo}` : '无关联'}</div>
                  <div>{formatTime(item.updatedAt)}</div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setSelectedTicketId(item.id)} className="h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">详情</button>
                  {item.status === 'open' && <button onClick={() => patchTicket(item.id, { status: 'in_progress' })} className="h-8 rounded-lg border border-blue-200 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-400/20 dark:hover:bg-blue-400/10">受理</button>}
                  {item.status !== 'resolved' && item.status !== 'closed' && <button onClick={() => patchTicket(item.id, { status: 'resolved', adminReply: item.adminReply || '问题已处理，如仍有异常请继续反馈。' })} className="h-8 rounded-lg border border-emerald-200 px-2.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/20 dark:hover:bg-emerald-400/10">解决</button>}
                </div>
              </div>
            ))}
            {!tickets.length && <EmptyState text="暂无反馈工单" />}
          </div>
        </div>
        <PaginationBar page={ticketPage} pageSize={20} total={ticketTotal} onPageChange={setTicketPage} />
      </div>
    </SectionShell>
  )
}
