import { lazy, Suspense } from 'react'
import { useStore } from '../../store'

const DetailModal = lazy(() => import('./components/detail-modal/DetailModal'))

function DetailModalLoading() {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-gray-950/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/60 bg-white/95 p-5 text-center shadow-2xl dark:border-white/[0.08] dark:bg-gray-900/95">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-slate-950 dark:border-white/[0.14] dark:border-t-white" />
        <div className="mt-4 text-sm font-semibold text-gray-950 dark:text-gray-50">详情加载中...</div>
        <div className="mt-1 text-xs text-gray-400">正在读取任务信息</div>
      </div>
    </div>
  )
}

export function DetailModalLazy() {
  const detailTaskId = useStore((state) => state.detailTaskId)
  if (!detailTaskId) return null

  return (
    <Suspense fallback={<DetailModalLoading />}>
      <DetailModal />
    </Suspense>
  )
}
