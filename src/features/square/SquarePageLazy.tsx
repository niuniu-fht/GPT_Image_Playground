import { lazy, Suspense } from 'react'

const SquarePage = lazy(() => import('./components/SquarePage'))

function SquarePageLoading() {
  return (
    <div className="grid min-h-[420px] place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04]">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-slate-950 dark:border-white/[0.14] dark:border-t-white" />
        <div className="mt-4 text-sm font-semibold text-gray-950 dark:text-gray-50">广场加载中...</div>
        <div className="mt-1 text-xs text-gray-400">正在同步公开分享内容</div>
      </div>
    </div>
  )
}

export function SquarePageLazy() {
  return (
    <Suspense fallback={<SquarePageLoading />}>
      <SquarePage />
    </Suspense>
  )
}
