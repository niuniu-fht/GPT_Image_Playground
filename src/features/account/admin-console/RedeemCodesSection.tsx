import { useMemo, useState, type FormEvent } from 'react'
import type { AdminRedeemCode } from '../../../types'
import { platformApi } from '../../../lib/platformApi'
import { useStore } from '../../../store'
import { AdminTableShell, EmptyState, formatTime, PaginationBar, SectionShell, StatusBadge, type RedeemCodeDraft } from './shared'

type RedeemCodesSectionProps = {
  redeemCodes: AdminRedeemCode[]
  redeemCodeQuery: string
  redeemCodeStatus: string
  redeemCodePage: number
  redeemCodeTotal: number
  setRedeemCodeQuery: (value: string) => void
  setRedeemCodeStatus: (value: string) => void
  setRedeemCodePage: (value: number) => void
  openRedeemCodeEditor: (item?: AdminRedeemCode) => void
  patchRedeemCode: (id: string, input: Partial<RedeemCodeDraft>) => void
  deleteRedeemCode: (id: string) => void
  onBatchCreated: () => void | Promise<void>
}

type BatchRedeemCodeDraft = Omit<RedeemCodeDraft, 'code'> & {
  prefix: string
  count: number
  codeLength: number
}

type ManualRedeemCodeDraft = Omit<RedeemCodeDraft, 'code'> & {
  codesText: string
}

const emptyBatchDraft: BatchRedeemCodeDraft = {
  prefix: 'VIP-',
  count: 20,
  codeLength: 12,
  name: '卡券店兑换码',
  credits: 100,
  maxRedemptions: 1,
  perUserLimit: 1,
  status: 'active',
  startsAt: null,
  endsAt: null,
  note: '批量生成，用于卡券店发放',
}

const emptyManualDraft: ManualRedeemCodeDraft = {
  codesText: '',
  name: '手动导入兑换码',
  credits: 100,
  maxRedemptions: 1,
  perUserLimit: 1,
  status: 'active',
  startsAt: null,
  endsAt: null,
  note: '批量手动加入',
}

function parseManualRedeemCodes(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function toDatetimeLocalValue(value: string | null | undefined) {
  return value
    ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : ''
}

export function RedeemCodesSection({
  redeemCodes,
  redeemCodeQuery,
  redeemCodeStatus,
  redeemCodePage,
  redeemCodeTotal,
  setRedeemCodeQuery,
  setRedeemCodeStatus,
  setRedeemCodePage,
  openRedeemCodeEditor,
  patchRedeemCode,
  deleteRedeemCode,
  onBatchCreated,
}: RedeemCodesSectionProps) {
  const showToast = useStore((state) => state.showToast)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchDraft, setBatchDraft] = useState<BatchRedeemCodeDraft>(emptyBatchDraft)
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([])
  const [manualOpen, setManualOpen] = useState(false)
  const [manualDraft, setManualDraft] = useState<ManualRedeemCodeDraft>(emptyManualDraft)
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [importedCodes, setImportedCodes] = useState<string[]>([])
  const activeCount = redeemCodes.filter((item) => item.status === 'active').length
  const issuedCredits = redeemCodes.reduce((sum, item) => sum + item.usedCount * item.credits, 0)
  const generatedText = useMemo(() => generatedCodes.join('\n'), [generatedCodes])
  const importedText = useMemo(() => importedCodes.join('\n'), [importedCodes])

  async function copyText(text: string, successText: string) {
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text)
      showToast(successText, 'success')
    } catch {
      showToast('复制失败，请手动选择文本复制', 'error')
    }
  }

  async function submitBatch(event: FormEvent) {
    event.preventDefault()
    setBatchSubmitting(true)
    try {
      const result = await platformApi.createAdminRedeemCodesBatch(batchDraft)
      setGeneratedCodes(result.codes)
      await onBatchCreated()
      showToast(`已生成 ${result.codes.length} 个兑换码`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量生成失败', 'error')
    } finally {
      setBatchSubmitting(false)
    }
  }

  async function submitManualBatch(event: FormEvent) {
    event.preventDefault()
    const codes = parseManualRedeemCodes(manualDraft.codesText)
    if (codes.length === 0) {
      showToast('请先粘贴兑换码，一行一个', 'error')
      return
    }
    const uniqueCodes = new Set(codes.map((code) => code.toUpperCase()))
    if (uniqueCodes.size !== codes.length) {
      showToast('输入内容里有重复兑换码，请检查后再提交', 'error')
      return
    }

    setManualSubmitting(true)
    try {
      const result = await platformApi.importAdminRedeemCodes({
        name: manualDraft.name,
        credits: manualDraft.credits,
        maxRedemptions: manualDraft.maxRedemptions,
        perUserLimit: manualDraft.perUserLimit,
        status: manualDraft.status,
        startsAt: manualDraft.startsAt,
        endsAt: manualDraft.endsAt,
        note: manualDraft.note,
        codes,
      })
      setImportedCodes(result.codes)
      await onBatchCreated()
      showToast(`已加入 ${result.codes.length} 个兑换码`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量加入失败', 'error')
    } finally {
      setManualSubmitting(false)
    }
  }

  return (
    <SectionShell
      title="兑换码"
      description="运营活动、客服补偿和卡券店发码统一在这里管理；批量生成后可按一码一行复制到外部店铺。"
      action={(
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setManualOpen(true)} className="h-10 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800 shadow-sm transition hover:bg-blue-100 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
            批量加入
          </button>
          <button onClick={() => setBatchOpen(true)} className="h-10 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            批量生成
          </button>
          <button onClick={() => openRedeemCodeEditor()} className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-gray-950">
            新增兑换码
          </button>
        </div>
      )}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="text-xs font-medium text-gray-400">当前页可用</div>
          <div className="mt-2 text-2xl font-bold">{activeCount}</div>
          <div className="mt-1 text-xs text-gray-500">停用后用户不能继续兑换</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="text-xs font-medium text-gray-400">当前页已领</div>
          <div className="mt-2 text-2xl font-bold">{redeemCodes.reduce((sum, item) => sum + item.usedCount, 0)}</div>
          <div className="mt-1 text-xs text-gray-500">按使用次数统计</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="text-xs font-medium text-gray-400">当前页发放积分</div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{issuedCredits}</div>
          <div className="mt-1 text-xs text-gray-500">兑换成功后产生积分流水</div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03] lg:flex-row">
        <input
          value={redeemCodeQuery}
          onChange={(event) => setRedeemCodeQuery(event.target.value)}
          placeholder="搜索兑换码、活动名、备注"
          className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950"
        />
        <select value={redeemCodeStatus} onChange={(event) => setRedeemCodeStatus(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-white/[0.08] dark:bg-gray-950">
          <option value="all">全部状态</option>
          <option value="active">可用</option>
          <option value="disabled">停用</option>
        </select>
      </div>

      <AdminTableShell
        mobileHint="横向滑动查看更多兑换码字段和操作"
        footer={<PaginationBar page={redeemCodePage} pageSize={20} total={redeemCodeTotal} onPageChange={setRedeemCodePage} />}
      >
        <div className="min-w-[1050px]">
            <div className="sticky top-0 z-20 grid grid-cols-[1.2fr_1.4fr_0.8fr_1fr_1fr_1.1fr_1.1fr_1.2fr] gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-[#171a22]">
              <span>兑换码</span>
              <span>活动</span>
              <span className="text-right">积分</span>
              <span>使用进度</span>
              <span>状态</span>
              <span>有效期</span>
              <span>最近兑换</span>
              <span className="text-right">操作</span>
            </div>
            {redeemCodes.map((item) => {
              const percent = Math.min(100, Math.round((item.usedCount / item.maxRedemptions) * 100))
              const disabled = item.status === 'disabled'
              return (
                <div key={item.id} className="grid grid-cols-[1.2fr_1.4fr_0.8fr_1fr_1fr_1.1fr_1.1fr_1.2fr] items-center gap-4 border-b border-gray-100 px-4 py-3 text-sm last:border-0 dark:border-white/[0.06]">
                  <div className="min-w-0">
                    <div className="truncate font-mono font-semibold text-gray-950 dark:text-gray-50">{item.code}</div>
                    <div className="mt-0.5 truncate text-xs text-gray-400">ID {item.id.slice(0, 12)}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{item.name}</div>
                    <div className="mt-0.5 truncate text-xs text-gray-400">{item.note || '无备注'}</div>
                  </div>
                  <div className="text-right font-semibold text-amber-700">{item.credits}</div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500"><span>{item.usedCount}/{item.maxRedemptions}</span><span>{percent}%</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.08]">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="mt-1 text-xs text-gray-400">每人 {item.perUserLimit} 次</div>
                  </div>
                  <StatusBadge tone={disabled ? 'gray' : 'green'}>{disabled ? '停用' : '可用'}</StatusBadge>
                  <div className="text-xs text-gray-500">
                    <div>{formatTime(item.startsAt) === '-' ? '立即开始' : formatTime(item.startsAt)}</div>
                    <div>{formatTime(item.endsAt) === '-' ? '长期有效' : formatTime(item.endsAt)}</div>
                  </div>
                  <div className="min-w-0 text-xs text-gray-500">
                    {item.redemptions?.[0] ? (
                      <>
                        <div className="truncate">{item.redemptions[0].user?.email ?? item.redemptions[0].userId}</div>
                        <div className="text-gray-400">{formatTime(item.redemptions[0].createdAt)}</div>
                      </>
                    ) : '暂无兑换'}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => void copyText(item.code, '兑换码已复制')} className="h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">复制</button>
                    <button onClick={() => openRedeemCodeEditor(item)} className="h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">编辑</button>
                    <button onClick={() => patchRedeemCode(item.id, { status: disabled ? 'active' : 'disabled' })} className="h-8 rounded-lg border border-blue-200 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-400/20 dark:hover:bg-blue-400/10">{disabled ? '启用' : '停用'}</button>
                    <button onClick={() => deleteRedeemCode(item.id)} className="h-8 rounded-lg border border-rose-200 px-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-400/20 dark:hover:bg-rose-400/10">删除</button>
                  </div>
                </div>
              )
            })}
            {!redeemCodes.length && <EmptyState text="暂无兑换码" />}
        </div>
      </AdminTableShell>

      {manualOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-950/40 px-4 py-6 backdrop-blur-sm">
          <form onSubmit={submitManualBatch} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-950/20 dark:border-white/[0.08] dark:bg-gray-950">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-white/[0.08]">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Batch import</div>
                <h3 className="mt-1 text-xl font-semibold text-gray-950 dark:text-gray-50">批量加入兑换码</h3>
                <p className="mt-1 text-sm text-gray-500">把外部已有兑换码粘贴进来：一行一个，换行就是新的一组。</p>
              </div>
              <button type="button" onClick={() => setManualOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-4 border-b border-gray-100 p-6 dark:border-white/[0.08] lg:border-b-0 lg:border-r">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  兑换码列表
                  <textarea
                    value={manualDraft.codesText}
                    onChange={(event) => setManualDraft((prev) => ({ ...prev, codesText: event.target.value }))}
                    rows={8}
                    placeholder={'VIP-CODE-001\nVIP-CODE-002\nVIP-CODE-003'}
                    className="mt-1.5 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-sm font-normal leading-6 text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100"
                  />
                  <span className="mt-1 block text-xs text-gray-500">空行会自动忽略；每行会创建一个独立兑换码。</span>
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="md:col-span-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                    批次名称
                    <input value={manualDraft.name} onChange={(event) => setManualDraft((prev) => ({ ...prev, name: event.target.value }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    每码积分
                    <input type="number" min={1} value={manualDraft.credits} onChange={(event) => setManualDraft((prev) => ({ ...prev, credits: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    每码最多兑换次数
                    <input type="number" min={1} value={manualDraft.maxRedemptions} onChange={(event) => setManualDraft((prev) => ({ ...prev, maxRedemptions: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    每用户限制
                    <input type="number" min={1} value={manualDraft.perUserLimit} onChange={(event) => setManualDraft((prev) => ({ ...prev, perUserLimit: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    状态
                    <select value={manualDraft.status} onChange={(event) => setManualDraft((prev) => ({ ...prev, status: event.target.value as ManualRedeemCodeDraft['status'] }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100">
                      <option value="active">可用</option>
                      <option value="disabled">停用</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    开始时间
                    <input type="datetime-local" value={toDatetimeLocalValue(manualDraft.startsAt)} onChange={(event) => setManualDraft((prev) => ({ ...prev, startsAt: event.target.value ? new Date(event.target.value).toISOString() : null }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    结束时间
                    <input type="datetime-local" value={toDatetimeLocalValue(manualDraft.endsAt)} onChange={(event) => setManualDraft((prev) => ({ ...prev, endsAt: event.target.value ? new Date(event.target.value).toISOString() : null }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                </div>

                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  备注
                  <textarea value={manualDraft.note} onChange={(event) => setManualDraft((prev) => ({ ...prev, note: event.target.value }))} rows={3} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                </label>
              </div>

              <div className="flex min-h-0 flex-col bg-gray-50/70 p-6 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">加入结果</div>
                    <div className="mt-0.5 text-xs text-gray-500">成功后显示已入库的兑换码。</div>
                  </div>
                  <button type="button" disabled={!importedText} onClick={() => void copyText(importedText, '已复制全部兑换码')} className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-200">
                    复制全部
                  </button>
                </div>
                <textarea readOnly value={importedText} placeholder="加入成功后会显示兑换码列表" className="mt-4 min-h-[280px] flex-1 resize-none rounded-xl border border-gray-200 bg-white p-3 font-mono text-sm leading-6 text-gray-900 outline-none dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100">
                  批量加入不会生成随机码，只会把你粘贴的每一行作为一个兑换码入库。
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-6 py-4 dark:border-white/[0.08] sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setManualOpen(false)} className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-200 dark:hover:bg-white/[0.06]">关闭</button>
              <button disabled={manualSubmitting} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-950">
                {manualSubmitting ? '加入中...' : '加入兑换码'}
              </button>
            </div>
          </form>
        </div>
      )}

      {batchOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-950/40 px-4 py-6 backdrop-blur-sm">
          <form onSubmit={submitBatch} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-950/20 dark:border-white/[0.08] dark:bg-gray-950">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-white/[0.08]">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Batch issue</div>
                <h3 className="mt-1 text-xl font-semibold text-gray-950 dark:text-gray-50">批量生成兑换码</h3>
                <p className="mt-1 text-sm text-gray-500">适合导入卡券商店：每个兑换码默认只能兑换一次，生成后可直接复制为一码一行。</p>
              </div>
              <button type="button" onClick={() => setBatchOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-4 border-b border-gray-100 p-6 dark:border-white/[0.08] lg:border-b-0 lg:border-r">
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    前缀
                    <input value={batchDraft.prefix} onChange={(event) => setBatchDraft((prev) => ({ ...prev, prefix: event.target.value.toUpperCase() }))} placeholder="VIP-" className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    数量
                    <input type="number" min={1} max={500} value={batchDraft.count} onChange={(event) => setBatchDraft((prev) => ({ ...prev, count: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    随机位数
                    <input type="number" min={8} max={32} value={batchDraft.codeLength} onChange={(event) => setBatchDraft((prev) => ({ ...prev, codeLength: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="md:col-span-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                    批次名称
                    <input value={batchDraft.name} onChange={(event) => setBatchDraft((prev) => ({ ...prev, name: event.target.value }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    每码积分
                    <input type="number" min={1} value={batchDraft.credits} onChange={(event) => setBatchDraft((prev) => ({ ...prev, credits: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    每码最多兑换次数
                    <input type="number" min={1} value={batchDraft.maxRedemptions} onChange={(event) => setBatchDraft((prev) => ({ ...prev, maxRedemptions: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    每用户限制
                    <input type="number" min={1} value={batchDraft.perUserLimit} onChange={(event) => setBatchDraft((prev) => ({ ...prev, perUserLimit: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    开始时间
                    <input type="datetime-local" value={batchDraft.startsAt ? new Date(new Date(batchDraft.startsAt).getTime() - new Date(batchDraft.startsAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={(event) => setBatchDraft((prev) => ({ ...prev, startsAt: event.target.value ? new Date(event.target.value).toISOString() : null }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    结束时间
                    <input type="datetime-local" value={batchDraft.endsAt ? new Date(new Date(batchDraft.endsAt).getTime() - new Date(batchDraft.endsAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={(event) => setBatchDraft((prev) => ({ ...prev, endsAt: event.target.value ? new Date(event.target.value).toISOString() : null }))} className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                </div>

                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  备注
                  <textarea value={batchDraft.note} onChange={(event) => setBatchDraft((prev) => ({ ...prev, note: event.target.value }))} rows={3} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none focus:border-amber-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                </label>
              </div>

              <div className="flex min-h-0 flex-col bg-gray-50/70 p-6 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">生成结果</div>
                    <div className="mt-0.5 text-xs text-gray-500">一码一行，可直接粘贴到卡券商店。</div>
                  </div>
                  <button type="button" disabled={!generatedText} onClick={() => void copyText(generatedText, '已复制全部兑换码')} className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-200">
                    复制全部
                  </button>
                </div>
                <textarea readOnly value={generatedText} placeholder="生成后会显示兑换码列表" className="mt-4 min-h-[280px] flex-1 resize-none rounded-xl border border-gray-200 bg-white p-3 font-mono text-sm leading-6 text-gray-900 outline-none dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100" />
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                  建议每个卡券商品对应一个批次名称；发给外部店铺前先复制保存生成结果，后续也可在表格中按批次名称搜索。
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-6 py-4 dark:border-white/[0.08] sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setBatchOpen(false)} className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-200 dark:hover:bg-white/[0.06]">关闭</button>
              <button disabled={batchSubmitting} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-950">
                {batchSubmitting ? '生成中...' : '生成兑换码'}
              </button>
            </div>
          </form>
        </div>
      )}
    </SectionShell>
  )
}
