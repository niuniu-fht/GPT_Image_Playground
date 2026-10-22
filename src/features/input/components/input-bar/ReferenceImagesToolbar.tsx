import type { RefObject } from 'react'
import ReferenceImageUrlPopover from './ReferenceImageUrlPopover'

interface ReferenceImagesToolbarProps {
  atImageLimit: boolean
  currentImageCount: number
  maxInputImages: number
  showImageUrlInput: boolean
  imageUrlInput: string
  imageUrlInputRef: RefObject<HTMLInputElement | null>
  imageUrlPopoverRef: RefObject<HTMLDivElement | null>
  onToggleImageUrlInput: () => void
  onImageUrlInputChange: (value: string) => void
  onCancelImageUrl: () => void
  onSubmitImageUrl: () => void
  onOpenFilePicker: () => void
}

export default function ReferenceImagesToolbar({
  atImageLimit,
  currentImageCount,
  maxInputImages,
  showImageUrlInput,
  imageUrlInput,
  imageUrlInputRef,
  imageUrlPopoverRef,
  onToggleImageUrlInput,
  onImageUrlInputChange,
  onCancelImageUrl,
  onSubmitImageUrl,
  onOpenFilePicker,
}: ReferenceImagesToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        参考图
        <span
          className={`rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
            atImageLimit
              ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-300'
              : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'
          }`}
          title={`当前「质量 × 分辨率」允许上传 ${maxInputImages} 张参考图`}
        >
          {currentImageCount}/{maxInputImages}
        </span>
      </span>
      <div className="relative flex gap-1">
        <button
          type="button"
          onClick={onToggleImageUrlInput}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
          title="添加公网图片 URL"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-1.414 1.414a4 4 0 01-5.657-5.656l1.414-1.414m3-3a4 4 0 015.657 0l1.414 1.414a4 4 0 01-5.657 5.656l-1.414-1.414" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onOpenFilePicker}
          disabled={atImageLimit}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
          title={atImageLimit ? `已达上限 ${maxInputImages} 张` : '添加本地图片'}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {showImageUrlInput && (
          <ReferenceImageUrlPopover
            imageUrlInput={imageUrlInput}
            imageUrlInputRef={imageUrlInputRef}
            imageUrlPopoverRef={imageUrlPopoverRef}
            onImageUrlInputChange={onImageUrlInputChange}
            onCancelImageUrl={onCancelImageUrl}
            onSubmitImageUrl={onSubmitImageUrl}
          />
        )}
      </div>
    </div>
  )
}
