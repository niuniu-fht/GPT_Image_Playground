import type { FormEvent } from 'react'
import type { AdminUpstreamProvider, AdminUpstreamTestResult } from '../../../../types'
import type { UpstreamDraft } from '../shared'
import { UpstreamConnectionFields } from './UpstreamConnectionFields'
import { UpstreamDiagnosticsPanel } from './UpstreamDiagnosticsPanel'
import { UpstreamSecurityFields } from './UpstreamSecurityFields'

interface UpstreamConfigDrawerProps {
  editingUpstreamId: string | null
  draft: UpstreamDraft
  setDraft: (updater: (prev: UpstreamDraft) => UpstreamDraft) => void
  upstreams: AdminUpstreamProvider[]
  upstreamTests: Record<string, AdminUpstreamTestResult>
  testingUpstreamId: string | null
  onSubmit: (event: FormEvent) => void
  onClose: () => void
  onDelete: () => void
  onTest: (id: string) => void
}

export function UpstreamConfigDrawer({
  editingUpstreamId,
  draft,
  setDraft,
  upstreams,
  upstreamTests,
  testingUpstreamId,
  onSubmit,
  onClose,
  onDelete,
  onTest,
}: UpstreamConfigDrawerProps) {
  return (
    <form onSubmit={onSubmit} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
      <UpstreamConnectionFields draft={draft} setDraft={setDraft} />
      <UpstreamSecurityFields draft={draft} setDraft={setDraft} editingUpstreamId={editingUpstreamId} />
      <UpstreamDiagnosticsPanel
        editingUpstreamId={editingUpstreamId}
        upstreams={upstreams}
        upstreamTests={upstreamTests}
        testingUpstreamId={testingUpstreamId}
        onTest={onTest}
      />
      <div className="sticky bottom-0 -mx-5 mt-6 flex gap-2 border-t border-gray-100 bg-white px-5 py-4 dark:border-white/[0.08] dark:bg-gray-900">
        {editingUpstreamId && (
          <button type="button" onClick={onDelete} className="h-10 rounded-xl border border-rose-200 px-4 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-400/20 dark:hover:bg-rose-400/10">
            删除
          </button>
        )}
        <button type="button" onClick={onClose} className="h-10 flex-1 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">
          取消
        </button>
        <button className="h-10 flex-1 rounded-xl bg-slate-950 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-gray-950">
          保存渠道
        </button>
      </div>
    </form>
  )
}
