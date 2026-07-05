import { lazy, Suspense } from 'react'
import { useStore } from '../../store'

const Lightbox = lazy(() => import('./components/lightbox/Lightbox'))

function LightboxLoading() {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/90 px-4 text-white">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <div className="mt-4 text-sm font-semibold">图片加载中...</div>
      </div>
    </div>
  )
}

export function LightboxLazy() {
  const lightboxImageId = useStore((state) => state.lightboxImageId)
  if (!lightboxImageId) return null

  return (
    <Suspense fallback={<LightboxLoading />}>
      <Lightbox />
    </Suspense>
  )
}
