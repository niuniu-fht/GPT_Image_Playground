import { lazy, Suspense } from 'react'
import { useStore } from '../../store'

const PromptLibraryDrawer = lazy(
  () => import('./components/prompt-library-drawer/PromptLibraryDrawer'),
)

function PromptLibraryDrawerLoading() {
  return (
    <div className="fixed inset-0 z-[72] flex justify-end bg-slate-950/25 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md items-center justify-center border-l border-white/50 bg-white/95 px-6 text-sm font-medium text-slate-700 shadow-2xl dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-200">
        提示词库加载中...
      </div>
    </div>
  )
}

export default function PromptLibraryDrawerLazy() {
  const showPromptLibrary = useStore((state) => state.showPromptLibrary)

  if (!showPromptLibrary) return null

  return (
    <Suspense fallback={<PromptLibraryDrawerLoading />}>
      <PromptLibraryDrawer />
    </Suspense>
  )
}
