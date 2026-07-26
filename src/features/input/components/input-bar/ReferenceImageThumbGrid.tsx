import type { InputImage } from '../../../../types'
import { isRemotePreviewUrl } from './shared'
import {
  REFERENCE_IMAGE_INDEX_ATTRIBUTE,
  useReferenceImageReorder,
} from './useReferenceImageReorder'

interface ReferenceImageThumbGridProps {
  inputImages: InputImage[]
  onPreviewImage: (imageId: string) => void
  onRemoveInputImage: (index: number) => void
  onMoveInputImage: (fromIndex: number, toIndex: number) => void
  onRequestClearAllImages: () => void
}

export default function ReferenceImageThumbGrid({
  inputImages,
  onPreviewImage,
  onRemoveInputImage,
  onMoveInputImage,
  onRequestClearAllImages,
}: ReferenceImageThumbGridProps) {
  const {
    announcement,
    draggedIndex,
    dropIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handleKeyDown,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handlePointerCancel,
    handlePreviewImage,
  } = useReferenceImageReorder({
    imageCount: inputImages.length,
    onPreviewImage,
    onMoveInputImage,
  })

  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,52px)] justify-between gap-x-2 gap-y-3"
      role="list"
      aria-label="参考图顺序"
    >
      {inputImages.map((image, index) => (
        <div
          key={image.id}
          className={`group relative inline-block select-none rounded-xl outline-none transition-[opacity,transform,box-shadow] focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
            draggedIndex === index ? 'scale-95 opacity-50' : ''
          } ${
            dropIndex === index && draggedIndex !== index
              ? 'ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-900'
              : ''
          }`}
          draggable
          role="listitem"
          tabIndex={0}
          aria-label={`图 ${index + 1}，拖动或使用方向键调整顺序`}
          title="拖动调整顺序；方向键也可移动"
          {...{ [REFERENCE_IMAGE_INDEX_ATTRIBUTE]: index }}
          onDragStart={(event) => handleDragStart(event, index)}
          onDragOver={(event) => handleDragOver(event, index)}
          onDrop={(event) => handleDrop(event, index)}
          onDragEnd={handleDragEnd}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          <div className="relative h-[52px] w-[52px] cursor-grab overflow-hidden rounded-xl border border-gray-200 shadow-sm active:cursor-grabbing dark:border-white/[0.08]">
            <img
              src={image.dataUrl}
              draggable={false}
              className="h-full w-full object-cover transition-opacity hover:opacity-90"
              onClick={() => handlePreviewImage(image.id)}
              alt={`参考图 ${index + 1}`}
            />
            <span
              className={`absolute left-1 top-1 rounded px-1 py-0.5 text-[9px] leading-none text-white shadow-sm ${
                isRemotePreviewUrl(image.dataUrl) ? 'bg-emerald-500/90' : 'bg-amber-500/90'
              }`}
            >
              {isRemotePreviewUrl(image.dataUrl) ? 'URL' : '本地'}
            </span>
            {image.maskDataUrl && (
              <span className="absolute bottom-1 right-1 rounded bg-emerald-500/90 px-1 py-0.5 text-[9px] leading-none text-white shadow-sm">
                蒙版
              </span>
            )}
          </div>
          <button
            type="button"
            draggable={false}
            className="absolute -right-2 -top-2 flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full bg-red-500 text-white opacity-100 shadow-md transition-opacity hover:bg-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            aria-label={`移除图 ${index + 1}`}
            title={`移除图 ${index + 1}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onRemoveInputImage(index)
            }}
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span
            className="mt-1 flex h-4 w-full touch-none cursor-grab items-center justify-center gap-0.5 rounded text-[10px] font-medium text-gray-500 transition-colors hover:text-blue-500 active:cursor-grabbing dark:text-gray-400 dark:hover:text-blue-300"
            aria-hidden="true"
            title={`移动图 ${index + 1}`}
            onPointerDown={(event) => handlePointerDown(event, index)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerCancel}
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeWidth={2} d="M8 7h.01M8 12h.01M8 17h.01M16 7h.01M16 12h.01M16 17h.01" />
            </svg>
            <span>图 {index + 1}</span>
          </span>
        </div>
      ))}

      <button
        type="button"
        onClick={onRequestClearAllImages}
        className="flex h-[52px] w-[52px] flex-shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-gray-300 text-gray-400 transition-all hover:border-red-300 hover:bg-red-50/50 hover:text-red-500 dark:border-white/[0.08] dark:text-gray-500 dark:hover:bg-red-950/30"
        title="清空全部参考图"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span className="text-[9px] leading-none">清空</span>
      </button>
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </div>
  )
}
