import { lazy, Suspense } from 'react'
import { useStore } from '../../store'

const ShareToSquareModal = lazy(() => import('./components/ShareToSquareModal'))

function ShareToSquareModalLoading() {
  return (
    <div className="fixed inset-0 z-[74] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/60 bg-white/95 p-5 text-center shadow-2xl ring-1 ring-black/5 dark:border-white/[0.08] dark:bg-gray-900/95 dark:ring-white/10">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-slate-950 dark:border-white/[0.14] dark:border-t-white" />
        <div className="mt-4 text-sm font-semibold text-gray-950 dark:text-gray-50">分享面板加载中...</div>
        <div className="mt-1 text-xs text-gray-400">正在准备广场发布流程</div>
      </div>
    </div>
  )
}

export function ShareToSquareModalLazy() {
  const target = useStore((state) => state.shareToSquareTarget)
  if (!target) return null

  return (
    <Suspense fallback={<ShareToSquareModalLoading />}>
      <ShareToSquareModal />
    </Suspense>
  )
}
