import { lazy, Suspense } from 'react'
import { useStore } from '../../store'

const ImageEditModal = lazy(() => import('./components/image-edit-modal/ImageEditModal'))

function ImageEditModalLoading() {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-gray-950/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900 p-5 text-center text-white shadow-2xl">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white" />
        <div className="mt-4 text-sm font-semibold">编辑器加载中...</div>
        <div className="mt-1 text-xs text-white/55">正在准备画布和选区工具</div>
      </div>
    </div>
  )
}

export function ImageEditModalLazy() {
  const imageEditSession = useStore((state) => state.imageEditSession)
  if (!imageEditSession) return null

  return (
    <Suspense fallback={<ImageEditModalLoading />}>
      <ImageEditModal />
    </Suspense>
  )
}
