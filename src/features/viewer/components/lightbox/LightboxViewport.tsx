import type { CSSProperties, MouseEventHandler, RefObject, WheelEventHandler } from 'react'

interface LightboxViewportProps {
  src: string
  showNav: boolean
  currentIndex: number
  total: number
  isZoomed: boolean
  isDragging: boolean
  showZoomBadge: boolean
  zoomPercent: number
  containerRef: RefObject<HTMLDivElement | null>
  imageStyle: CSSProperties
  onWheel: WheelEventHandler<HTMLDivElement>
  onClick: MouseEventHandler<HTMLDivElement>
  onDoubleClick: MouseEventHandler<HTMLDivElement>
  onPrev: () => void
  onNext: () => void
}

export default function LightboxViewport(props: LightboxViewportProps) {
  const {
    src,
    showNav,
    currentIndex,
    total,
    isZoomed,
    isDragging,
    showZoomBadge,
    zoomPercent,
    containerRef,
    imageStyle,
    onWheel,
    onClick,
    onDoubleClick,
    onPrev,
    onNext,
  } = props

  const navButtonClass =
    'absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-all hover:bg-black/60'

  return (
    <div
      ref={containerRef}
      data-lightbox-root
      className="fixed inset-0 z-[60] flex select-none items-center justify-center"
      style={{
        cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
        overscrollBehavior: 'none',
        touchAction: 'none',
      }}
      onWheel={onWheel}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-md" />
      <div className="relative animate-zoom-in">
        <img
          src={src}
          className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
          style={imageStyle}
          onDragStart={(event) => event.preventDefault()}
          alt=""
        />
      </div>

      {showNav && !isZoomed && (
        <>
          <button
            type="button"
            className={`${navButtonClass} left-3 sm:left-5`}
            onClick={(event) => {
              event.stopPropagation()
              onPrev()
            }}
          >
            <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            className={`${navButtonClass} right-3 sm:right-5`}
            onClick={(event) => {
              event.stopPropagation()
              onNext()
            }}
          >
            <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {showZoomBadge && isZoomed && zoomPercent !== 100 && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm transition-opacity duration-500">
            {zoomPercent}%
          </span>
        </div>
      )}

      {showNav && !isZoomed && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm">
            {currentIndex + 1} / {total}
          </span>
        </div>
      )}
    </div>
  )
}
