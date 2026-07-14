import { useEffect, useState } from 'react'
import type { ImageAssetView, ImageAssetViewOptions } from '../store/imageAssets'
import { getImageView } from '../store'
import { IMAGE_ASSET_CACHE_UPDATED_EVENT } from '../store/cache'

export interface UseImageAssetViewResult {
  imageId: string
  view: ImageAssetView | null
  url: string
  metadata: ImageAssetView['metadata']
  status: 'idle' | 'loading' | 'ready' | 'error'
}

function shouldLoadMetadata(options: ImageAssetViewOptions): boolean {
  return Boolean(options.includeMetadata || options.inferMetadataFromUrl)
}

export function useImageAssetView(
  imageId: string | null | undefined,
  options: ImageAssetViewOptions = {},
): UseImageAssetViewResult {
  const [resolvedImageId, setResolvedImageId] = useState('')
  const [view, setView] = useState<ImageAssetView | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const normalizedImageId =
    typeof imageId === 'string' && imageId.trim() ? imageId.trim() : ''
  const variant = options.variant ?? 'original'
  const includeMetadata = Boolean(options.includeMetadata)
  const inferMetadataFromUrl = Boolean(options.inferMetadataFromUrl)
  const metadataRequested = shouldLoadMetadata(options)

  useEffect(() => {
    if (!normalizedImageId) {
      setResolvedImageId('')
      setView(null)
      setStatus('idle')
      return
    }

    let cancelled = false
    const viewOptions: ImageAssetViewOptions = {
      variant,
      includeMetadata,
      inferMetadataFromUrl,
    }

    const loadImageView = () => {
      const handle = getImageView(normalizedImageId, variant)
      const cachedView = handle.displayUrl
        ? { url: handle.displayUrl, metadata: handle.metadata } as ImageAssetView
        : null
      if (cachedView && (!metadataRequested || cachedView.metadata)) {
        setResolvedImageId(normalizedImageId)
        setView(cachedView)
        setStatus('ready')
        return
      }

      setResolvedImageId(normalizedImageId)
      if (cachedView) {
        setView(cachedView)
      } else {
        setView(null)
      }
      setStatus('loading')

      void getImageView(normalizedImageId, variant).reload().then(h => h.displayUrl ? { url: h.displayUrl, metadata: h.metadata } as ImageAssetView : null)
        .then((nextView) => {
          if (cancelled) {
            return
          }

          if (nextView) {
            setView(nextView)
            setStatus('ready')
            return
          }

          setView(null)
          setStatus('error')
        })
        .catch(() => {
          if (!cancelled) {
            setView(null)
            setStatus('error')
          }
        })
    }

    const handleImageCacheUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ imageId?: unknown; variant?: unknown }>).detail
      if (
        !cancelled &&
        detail?.imageId === normalizedImageId &&
        (detail.variant === undefined || detail.variant === variant)
      ) {
        loadImageView()
      }
    }

    loadImageView()
    window.addEventListener(IMAGE_ASSET_CACHE_UPDATED_EVENT, handleImageCacheUpdated)

    return () => {
      cancelled = true
      window.removeEventListener(IMAGE_ASSET_CACHE_UPDATED_EVENT, handleImageCacheUpdated)
    }
  }, [
    includeMetadata,
    inferMetadataFromUrl,
    metadataRequested,
    normalizedImageId,
    variant,
  ])

  const isCurrentView = resolvedImageId === normalizedImageId

  return {
    imageId: isCurrentView ? resolvedImageId : '',
    view: isCurrentView ? view : null,
    url: isCurrentView ? view?.url ?? '' : '',
    metadata: isCurrentView ? view?.metadata ?? null : null,
    status,
  }
}
