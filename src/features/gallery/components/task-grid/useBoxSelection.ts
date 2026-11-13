import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'
import { BOX_SELECT_THRESHOLD, isSelectableGridTarget, rectsIntersect, type SelectionBox } from './shared'

interface UseBoxSelectionOptions {
  gridRef: RefObject<HTMLDivElement | null>
  filteredTaskCount: number
  selectedTaskIds: string[]
  clearSelectedTasks: () => void
  setSelectedTaskIds: (taskIds: string[]) => void
  onStartSelection: () => void
}

interface DragSession {
  /** 拖拽锚点，文档坐标（client 坐标 + 滚动偏移），滚动时框子跟随内容 */
  startDocX: number
  startDocY: number
  lastClientX: number
  lastClientY: number
  additive: boolean
  initialSelectedIds: string[]
  startedOnTaskCard: boolean
  dragging: boolean
  scrollContainer: HTMLElement | Window | null
}

function getScrollContainer(gridRef: RefObject<HTMLDivElement | null>): HTMLElement | Window | null {
  let element: HTMLElement | null = gridRef.current?.parentElement ?? null
  while (element && element !== document.body) {
    const overflowY = getComputedStyle(element).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') return element
    element = element.parentElement
  }
  return window
}

function readScrollOffsets(container: HTMLElement | Window | null): { x: number; y: number } {
  if (!container) return { x: 0, y: 0 }
  if (container === window) return { x: window.scrollX, y: window.scrollY }
  const element = container as HTMLElement
  return { x: element.scrollLeft, y: element.scrollTop }
}

/** 拖拽时指针接近滚动容器上下边缘时自动滚动 */
function autoScroll(container: HTMLElement | Window | null, clientY: number): void {
  if (!container || container === window) return
  const element = container as HTMLElement
  const rect = element.getBoundingClientRect()
  const edge = 64
  if (clientY > rect.bottom - edge) {
    element.scrollTop += Math.min(24, Math.ceil((clientY - (rect.bottom - edge)) / 4))
  } else if (clientY < rect.top + edge) {
    element.scrollTop -= Math.min(24, Math.ceil((rect.top + edge - clientY) / 4))
  }
}

export function useBoxSelection({
  gridRef,
  filteredTaskCount,
  selectedTaskIds,
  clearSelectedTasks,
  setSelectedTaskIds,
  onStartSelection,
}: UseBoxSelectionOptions) {
  const boxSelectionRef = useRef<DragSession | null>(null)
  const suppressOpenUntilRef = useRef(0)
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null)

  useEffect(
    () => () => {
      document.body.style.userSelect = ''
    },
    [],
  )

  const handleGridMouseDownCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !filteredTaskCount || !isSelectableGridTarget(event.target)) return

    onStartSelection()
    const target = event.target instanceof HTMLElement ? event.target : null
    const scrollContainer = getScrollContainer(gridRef)
    const offsets = readScrollOffsets(scrollContainer)
    boxSelectionRef.current = {
      startDocX: event.clientX + offsets.x,
      startDocY: event.clientY + offsets.y,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      additive: event.ctrlKey || event.metaKey,
      initialSelectedIds: selectedTaskIds,
      startedOnTaskCard: Boolean(target?.closest('[data-task-card-root]')),
      dragging: false,
      scrollContainer,
    }

    const updateSelection = (clientX: number, clientY: number) => {
      const currentSelection = boxSelectionRef.current
      if (!currentSelection) return

      const offsets = readScrollOffsets(currentSelection.scrollContainer)
      // 锚点与当前点都换算成文档坐标：滚动时框子跟随内容，不再钉在屏幕上
      const anchorViewX = currentSelection.startDocX - offsets.x
      const anchorViewY = currentSelection.startDocY - offsets.y
      const nextBox = {
        left: Math.min(anchorViewX, clientX),
        top: Math.min(anchorViewY, clientY),
        width: Math.abs(clientX - anchorViewX),
        height: Math.abs(clientY - anchorViewY),
      }
      setSelectionBox(nextBox)

      const boxRect = new DOMRect(nextBox.left, nextBox.top, nextBox.width, nextBox.height)
      const taskCards = Array.from(
        gridRef.current?.querySelectorAll<HTMLElement>('[data-task-card-root][data-task-id]') ?? [],
      )
      const visibleIds = new Set<string>()
      const hitTaskIds: string[] = []
      for (const card of taskCards) {
        const taskId = card.dataset.taskId || ''
        if (!taskId) continue
        visibleIds.add(taskId)
        if (rectsIntersect(card.getBoundingClientRect(), boxRect)) hitTaskIds.push(taskId)
      }
      // 虚拟列表：滚出视口被卸载的卡片无法参与命中测试，保留它们之前的选择态
      const preservedIds = currentSelection.initialSelectedIds.filter((id) => !visibleIds.has(id))

      setSelectedTaskIds(
        currentSelection.additive
          ? Array.from(new Set([...currentSelection.initialSelectedIds, ...hitTaskIds]))
          : Array.from(new Set([...hitTaskIds, ...preservedIds])),
      )
    }

    const runUpdateFromLastPointer = () => {
      const currentSelection = boxSelectionRef.current
      if (!currentSelection?.dragging) return
      updateSelection(currentSelection.lastClientX, currentSelection.lastClientY)
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentSelection = boxSelectionRef.current
      if (!currentSelection) return
      currentSelection.lastClientX = moveEvent.clientX
      currentSelection.lastClientY = moveEvent.clientY

      const deltaX = moveEvent.clientX - (currentSelection.startDocX - readScrollOffsets(currentSelection.scrollContainer).x)
      const deltaY = moveEvent.clientY - (currentSelection.startDocY - readScrollOffsets(currentSelection.scrollContainer).y)
      const distance = Math.hypot(deltaX, deltaY)
      if (!currentSelection.dragging && distance < BOX_SELECT_THRESHOLD) return

      if (!currentSelection.dragging) {
        currentSelection.dragging = true
        document.body.style.userSelect = 'none'
      }

      autoScroll(currentSelection.scrollContainer, moveEvent.clientY)
      updateSelection(moveEvent.clientX, moveEvent.clientY)
    }

    const handleScroll = () => {
      // 拖拽中滚动（滚轮/自动滚动）：框子跟随内容重新做命中测试
      runUpdateFromLastPointer()
    }

    const finishSelection = () => {
      const currentSelection = boxSelectionRef.current
      if (currentSelection?.dragging) {
        suppressOpenUntilRef.current = Date.now() + 180
      } else if (!currentSelection?.additive && !currentSelection?.startedOnTaskCard) {
        clearSelectedTasks()
      }

      boxSelectionRef.current = null
      setSelectionBox(null)
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', finishSelection)
      window.removeEventListener('scroll', handleScroll, true)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', finishSelection)
    window.addEventListener('scroll', handleScroll, true)
  }

  return {
    selectionBox,
    handleGridMouseDownCapture,
    shouldSuppressTaskOpen: () => Date.now() < suppressOpenUntilRef.current,
  }
}
