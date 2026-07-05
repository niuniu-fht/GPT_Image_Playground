import { lazy, Suspense } from 'react'
import { useStore } from '../../store'

const SettingsModal = lazy(() => import('./components/settings-modal/SettingsModal'))

function SettingsModalLoading() {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35 px-6 backdrop-blur-sm">
      <div className="rounded-lg border border-white/70 bg-white/95 px-5 py-4 text-sm font-medium text-slate-700 shadow-xl ring-1 ring-black/5 dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-200 dark:ring-white/10">
        设置加载中...
      </div>
    </div>
  )
}

export default function SettingsModalLazy() {
  const showSettings = useStore((state) => state.showSettings)

  if (!showSettings) return null

  return (
    <Suspense fallback={<SettingsModalLoading />}>
      <SettingsModal />
    </Suspense>
  )
}
