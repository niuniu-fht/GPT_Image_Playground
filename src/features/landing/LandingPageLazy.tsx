import { lazy, Suspense } from 'react'

const LandingPage = lazy(() => import('./LandingPage'))

function LandingPageLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f9fc] px-6 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 dark:border-white/15 dark:border-t-white" />
        <div className="mt-4 text-sm font-semibold">首页加载中...</div>
      </div>
    </main>
  )
}

export default function LandingPageLazy() {
  return (
    <Suspense fallback={<LandingPageLoading />}>
      <LandingPage />
    </Suspense>
  )
}
