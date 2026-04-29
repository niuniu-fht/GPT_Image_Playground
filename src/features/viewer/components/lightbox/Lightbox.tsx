import { useCloseOnEscape } from '../../../../hooks/useCloseOnEscape'
import LightboxViewport from './LightboxViewport'
import { useLightboxState } from './useLightboxState'
import { useLightboxTransform } from './useLightboxTransform'

export default function Lightbox() {
  const { lightboxImageId, src, close, showNav, currentIndex, total, goPrev, goNext } = useLightboxState()

  useCloseOnEscape(Boolean(lightboxImageId), close)

  const {
    containerRef,
    imageStyle,
    isZoomed,
    isDragging,
    showZoomBadge,
    zoomPercent,
    handleWheel,
    handleClick,
    handleDoubleClick,
  } = useLightboxTransform({
    src,
    onClose: close,
  })

  if (!lightboxImageId || !src) return null

  return (
    <LightboxViewport
      src={src}
      showNav={showNav}
      currentIndex={currentIndex}
      total={total}
      isZoomed={isZoomed}
      isDragging={isDragging}
      showZoomBadge={showZoomBadge}
      zoomPercent={zoomPercent}
      containerRef={containerRef}
      imageStyle={imageStyle}
      onWheel={handleWheel}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onPrev={goPrev}
      onNext={goNext}
    />
  )
}
