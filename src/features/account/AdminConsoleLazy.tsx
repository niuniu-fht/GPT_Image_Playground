import { lazy, Suspense } from 'react'
import { useStore } from '../../store'

const AdminConsole = lazy(() => import('./AdminConsole'))

function AdminConsoleLoading() {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[#f5f7fb]/90 px-4 text-gray-950 backdrop-blur-sm dark:bg-gray-950/90 dark:text-gray-50">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-2xl shadow-gray-950/10 dark:border-white/[0.08] dark:bg-gray-900">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-slate-950 dark:border-white/[0.14] dark:border-t-white" />
        <div className="mt-4 text-sm font-semibold">后台加载中...</div>
        <div className="mt-1 text-xs text-gray-400">正在打开运营控制台</div>
      </div>
    </div>
  )
}

export function AdminConsoleLazy() {
  const open = useStore((state) => state.showAdminModels)
  if (!open) return null

  return (
    <Suspense fallback={<AdminConsoleLoading />}>
      <AdminConsole />
    </Suspense>
  )
}
