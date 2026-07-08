import { useCloseOnEscape } from '../../../../hooks/useCloseOnEscape'
import { downloadImageFromSrc } from '../../../../lib/downloadImage'
import { resolveRemoteImageAccessMessage } from '../../../../lib/remoteImageAccess'
import { useStore } from '../../../../store'
import LightboxViewport from './LightboxViewport'
import { useLightboxState } from './useLightboxState'
import { useLightboxTransform } from './useLightboxTransform'

export default function Lightbox() {
  const { lightboxImageId, src, close, showNav, currentIndex, total, goPrev, goNext } = useLightboxState()
  const showToast = useStore((state) => state.showToast)

  useCloseOnEscape(Boolean(lightboxImageId), close)

  const {
    containerRef,
    stageRef,
    imageStyle,
    isZoomed,
    isDragging,
    showZoomBadge,
    zoomPercent,
    handleBackdropClick,
    handleStageDoubleClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } = useLightboxTransform({
    src,
    onClose: close,
  })

  if (!lightboxImageId || !src) return null

  const handleDownload = async () => {
    try {
      await downloadImageFromSrc(src, `image-${currentIndex + 1}`)
      showToast('开始下载', 'success')
    } catch (error) {
      console.error(error)
      window.open(src, '_blank', 'noopener,noreferrer')
      showToast(resolveRemoteImageAccessMessage(error, 'download'), 'error')
    }
  }

  return (
    <LightboxViewport
      src={src}
      onClose={close}
      showNav={showNav}
      currentIndex={currentIndex}
      total={total}
      isZoomed={isZoomed}
      isDragging={isDragging}
      showZoomBadge={showZoomBadge}
      zoomPercent={zoomPercent}
      containerRef={containerRef}
      stageRef={stageRef}
      imageStyle={imageStyle}
      onBackdropClick={handleBackdropClick}
      onStageDoubleClick={handleStageDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDownload={() => void handleDownload()}
      onPrev={goPrev}
      onNext={goNext}
    />
  )
}
