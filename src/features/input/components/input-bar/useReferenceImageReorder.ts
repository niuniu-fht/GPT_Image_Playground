import {
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'

interface PointerDragState {
  pointerId: number
  fromIndex: number
  startX: number
  startY: number
  active: boolean
  toIndex: number
}

interface UseReferenceImageReorderOptions {
  imageCount: number
  onPreviewImage: (imageId: string) => void
  onMoveInputImage: (fromIndex: number, toIndex: number) => void
}

export const REFERENCE_IMAGE_INDEX_ATTRIBUTE = 'data-reference-image-index'

const POINTER_DRAG_THRESHOLD = 6
const DRAG_DATA_TYPE = 'text/reference-image-index'

export function useReferenceImageReorder({
  imageCount,
  onPreviewImage,
  onMoveInputImage,
}: UseReferenceImageReorderOptions) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const pointerDragRef = useRef<PointerDragState | null>(null)
  const suppressPreviewRef = useRef(false)

  const resetDragState = () => {
    pointerDragRef.current = null
    setDraggedIndex(null)
    setDropIndex(null)
  }

  const releasePreviewSuppression = () => {
    window.setTimeout(() => {
      suppressPreviewRef.current = false
    }, 0)
  }

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (fromIndex !== toIndex) {
      onMoveInputImage(fromIndex, toIndex)
      setAnnouncement(`已将图 ${fromIndex + 1} 移动为图 ${toIndex + 1}`)
    }
    resetDragState()
  }

  const handleDragStart = (event: DragEvent<HTMLDivElement>, index: number) => {
    suppressPreviewRef.current = true
    setDraggedIndex(index)
    setDropIndex(index)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(DRAG_DATA_TYPE, String(index))
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    if (draggedIndex === null) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setDropIndex(index)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault()
    event.stopPropagation()
    const transferredValue = event.dataTransfer.getData(DRAG_DATA_TYPE)
    const transferredIndex = Number(transferredValue)
    const fromIndex = transferredValue && Number.isInteger(transferredIndex)
      ? transferredIndex
      : draggedIndex
    if (fromIndex !== null) {
      moveImage(fromIndex, index)
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLElement>, index: number) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerDragRef.current = {
      pointerId: event.pointerId,
      fromIndex: index,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      toIndex: index,
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const pointerDrag = pointerDragRef.current
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return

    const distance = Math.hypot(
      event.clientX - pointerDrag.startX,
      event.clientY - pointerDrag.startY,
    )
    if (!pointerDrag.active && distance < POINTER_DRAG_THRESHOLD) return

    event.preventDefault()
    pointerDrag.active = true
    suppressPreviewRef.current = true
    setDraggedIndex(pointerDrag.fromIndex)

    const elementAtPointer = document.elementFromPoint(event.clientX, event.clientY)
    const target = elementAtPointer?.closest<HTMLElement>(`[${REFERENCE_IMAGE_INDEX_ATTRIBUTE}]`)
    const targetIndex = Number(target?.getAttribute(REFERENCE_IMAGE_INDEX_ATTRIBUTE))
    if (Number.isInteger(targetIndex)) {
      pointerDrag.toIndex = targetIndex
      setDropIndex(targetIndex)
    }
  }

  const handlePointerEnd = (event: PointerEvent<HTMLElement>) => {
    const pointerDrag = pointerDragRef.current
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return

    event.preventDefault()
    event.stopPropagation()
    if (pointerDrag.active) {
      moveImage(pointerDrag.fromIndex, pointerDrag.toIndex)
    } else {
      resetDragState()
    }
    releasePreviewSuppression()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (event.target !== event.currentTarget) return

    const direction =
      event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? -1
        : event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : 0
    if (direction === 0) return

    event.preventDefault()
    const nextIndex = Math.min(imageCount - 1, Math.max(0, index + direction))
    moveImage(index, nextIndex)
  }

  return {
    announcement,
    draggedIndex,
    dropIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd: () => {
      resetDragState()
      releasePreviewSuppression()
    },
    handleKeyDown,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handlePointerCancel: () => {
      resetDragState()
      releasePreviewSuppression()
    },
    handlePreviewImage: (imageId: string) => {
      if (!suppressPreviewRef.current) {
        onPreviewImage(imageId)
      }
    },
  }
}
