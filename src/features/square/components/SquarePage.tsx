import { useEffect, useMemo, useRef, useState } from 'react'
import ExperienceTopNav from '../../../app/components/experience-nav/ExperienceTopNav'
import type { AppView, SquareShareAssetSummary, SquareShareSummary } from '../../../types'
import { useStore } from '../../../store'
import { useSquareFeed } from '../hooks/useSquareFeed'
import { useSquareGridMetrics } from '../hooks/useSquareGridMetrics'
import { resolveSquareAssetUrl, squareApiClient, summarizeSquareShare } from '../lib/squareApiClient'
import SquareAtmosphere from './SquareAtmosphere'
import SquareCard from './SquareCard'
import SquareImageLightbox, { type SquareLightboxImage } from './SquareImageLightbox'

function resolveAssetPreviewImage(
  asset: SquareShareAssetSummary | null | undefined,
  title: string,
): SquareLightboxImage | null {
  const url = asset?.originalUrl || asset?.thumbUrl
  if (!url) return null

  return {
    src: resolveSquareAssetUrl(url),
    title,
  }
}

function hasPreviewImage(item: SquareShareSummary): boolean {
  return Boolean(item.coverAsset?.originalUrl || item.coverAsset?.thumbUrl)
}

export default function SquarePage() {
  const currentUser = useStore((state) => state.currentUser)
  const openAuthModal = useStore((state) => state.openAuthModal)
  const setAppView = useStore((state) => state.setAppView)
  const setShowAdminModels = useStore((state) => state.setShowAdminModels)
  const showToast = useStore((state) => state.showToast)
  const [previewImages, setPreviewImages] = useState<SquareLightboxImage[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [promptShare, setPromptShare] = useState<SquareShareSummary | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const gridMetrics = useSquareGridMetrics(gridRef)
  const feed = useSquareFeed({ kind: 'task', query: '' })
  const imageItems = useMemo(() => feed.items.filter(hasPreviewImage), [feed.items])

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target || !feed.nextCursor) return undefined

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries
      if (entry?.isIntersecting && !feed.isLoadingMore) {
        void feed.loadMore()
      }
    }, { rootMargin: '640px 0px' })

    observer.observe(target)
    return () => observer.disconnect()
  }, [feed])

  const handleOpenImagePreview = async (item: SquareShareSummary) => {
    const title = summarizeSquareShare(item)
    const fallbackImage = resolveAssetPreviewImage(item.coverAsset, title)
    if (!fallbackImage) return

    setPreviewImages([fallbackImage])
    setPreviewIndex(0)

    try {
      const detail = await squareApiClient.getShare(item.id)
      const detailImages = (detail.assets ?? [])
        .map((asset, index) => resolveAssetPreviewImage(asset, `${title} ${index + 1}`))
        .filter((image): image is SquareLightboxImage => Boolean(image))
      if (detailImages.length > 0) {
        setPreviewImages(detailImages)
        const coverIndex = detailImages.findIndex((image) => image.src === fallbackImage.src)
        setPreviewIndex(coverIndex >= 0 ? coverIndex : 0)
      }
    } catch (error) {
      console.warn('加载广场分享详情失败，已使用封面图预览', error)
    }
  }

  const handleCopyPrompt = async () => {
    const prompt = promptShare?.prompt.trim()
    if (!prompt) return

    try {
      await navigator.clipboard.writeText(prompt)
      showToast('提示词已复制', 'success')
    } catch {
      showToast('复制提示词失败', 'error')
    }
  }

  function openAdminConsole() {
    if (window.location.pathname !== '/admin') {
      window.history.pushState(null, '', '/admin')
    }
    setShowAdminModels(true)
  }

  function handleNavigate(view: AppView) {
    if (view === 'local' && !currentUser) {
      openAuthModal('login')
      return
    }
    setAppView(view)
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#f4f7fb] text-slate-950 dark:bg-[#090909] dark:text-white">
      <SquareAtmosphere />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),transparent_28%,rgba(15,23,42,0.08)_54%,transparent_78%),linear-gradient(180deg,rgba(248,250,252,0.86),rgba(226,232,240,0.58)_55%,rgba(248,250,252,0.95)_100%)] dark:bg-[linear-gradient(180deg,rgba(9,9,9,0.12),rgba(9,9,9,0.56)_58%,rgba(9,9,9,0.9)_100%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.28] [background-image:linear-gradient(rgba(15,23,42,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.10)_1px,transparent_1px)] [background-size:44px_44px] dark:opacity-100 dark:bg-[linear-gradient(90deg,rgba(0,0,0,0.34),transparent_24%,transparent_76%,rgba(0,0,0,0.34))] dark:[background-image:none]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.52)_100%)] dark:bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.42)_100%)]" />
      <div className="fixed left-0 right-0 top-0 z-30 bg-gradient-to-b from-black/60 to-transparent pb-8 dark:from-black/72">
        <ExperienceTopNav
          appView="square"
          currentUser={currentUser}
          onAdmin={openAdminConsole}
          onLogin={() => openAuthModal('login')}
          onNavigate={handleNavigate}
        />
      </div>

      <section className="relative z-10 mx-auto w-full max-w-[1720px] px-4 pb-24 pt-28 sm:px-6 md:pt-24 lg:px-8">
        {feed.isLoading ? (
          <div ref={gridRef} className="grid auto-rows-[4px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 12 }, (_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-[32px] bg-white/[0.07]"
                style={{
                  gridColumnEnd: `span ${index % 5 === 0 && gridMetrics.columnCount > 1 ? 2 : 1}`,
                  gridRowEnd: `span ${index % 5 === 0 ? 27 : index % 3 === 0 ? 34 : 29}`,
                }}
              />
            ))}
          </div>
        ) : imageItems.length === 0 ? (
          <div className="grid min-h-[70vh] place-items-center px-4 text-center">
            <div>
              <div className="text-lg font-semibold text-white/88">
                {feed.error ? '广场暂时没有加载成功' : '还没有可以展示的作品'}
              </div>
              <div className="mt-2 max-w-sm text-sm leading-6 text-white/45">
                {feed.error || '发布带图片的作品后，这里会自动形成作品流。'}
              </div>
              {feed.error && (
                <button
                  type="button"
                  onClick={() => {
                    void feed.reload()
                  }}
                  className="mt-5 h-10 rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200"
                >
                  重新加载
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div ref={gridRef} className="grid auto-rows-[4px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {imageItems.map((item) => (
                <SquareCard
                  key={item.id}
                  item={item}
                  metrics={gridMetrics}
                  onOpenImage={(targetItem) => {
                    void handleOpenImagePreview(targetItem)
                  }}
                  onViewPrompt={setPromptShare}
                />
              ))}
            </div>

            <div ref={loadMoreRef} className="h-16" />
            {feed.isLoadingMore && (
              <div className="flex justify-center pb-2 pt-2">
                <div className="inline-flex h-11 items-center gap-3 rounded-full border border-white/12 bg-white/[0.06] px-4 text-sm text-white/72 backdrop-blur-xl">
                  <span className="h-4 w-4 animate-spin rounded-full border border-white/18 border-t-white/80" />
                  继续加载作品
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {promptShare && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 backdrop-blur-md dark:bg-black/70" onClick={() => setPromptShare(null)}>
          <div
            className="w-full max-w-2xl rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-2xl shadow-slate-950/20 dark:border-white/15 dark:bg-[#111] dark:shadow-black/40"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-700 dark:text-white/80">提示词</div>
              <button
                type="button"
                onClick={() => setPromptShare(null)}
                className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="关闭"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-4 max-h-[46vh] overflow-y-auto whitespace-pre-wrap break-words text-base font-medium leading-8 text-slate-950 dark:text-white/90">
              {promptShare.prompt.trim() || '这个作品没有保存提示词。'}
            </p>
            {promptShare.prompt.trim() && (
              <button
                type="button"
                onClick={() => {
                  void handleCopyPrompt()
                }}
                className="mt-5 h-10 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                复制提示词
              </button>
            )}
          </div>
        </div>
      )}

      {previewImages.length > 0 && (
        <SquareImageLightbox
          images={previewImages}
          activeIndex={previewIndex}
          onActiveIndexChange={setPreviewIndex}
          onClose={() => {
            setPreviewImages([])
            setPreviewIndex(0)
          }}
        />
      )}
    </main>
  )
}
