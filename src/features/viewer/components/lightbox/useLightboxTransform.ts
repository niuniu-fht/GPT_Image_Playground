import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEventHandler,
  type WheelEventHandler,
} from 'react'
import { clamp, MAX_SCALE, MIN_SCALE } from './shared'

interface UseLightboxTransformOptions {
  src: string
  onClose: () => void
}

export function useLightboxTransform(options: UseLightboxTransformOptions) {
  const { src, onClose } = options
  const containerRef = useRef<HTMLDivElement | null>(null)
  const scaleRef = useRef(1)
  const txRef = useRef(0)
  const tyRef = useRef(0)
  const [, forceRender] = useState(0)
  const [showZoomBadge, setShowZoomBadge] = useState(false)
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    baseTx: 0,
    baseTy: 0,
  })
  const pinchRef = useRef({
    active: false,
    startDist: 0,
    startScale: 1,
    startTx: 0,
    startTy: 0,
    midX: 0,
    midY: 0,
  })
  const tapRef = useRef({ time: 0, x: 0, y: 0 })
  const hadMultiTouchRef = useRef(false)
  const touchStartedOnImageRef = useRef(false)
  const didDragRef = useRef(false)
  const suppressNextClickRef = useRef(false)

  const rerender = useCallback(() => {
    forceRender((count) => count + 1)
  }, [])

  useEffect(() => {
    scaleRef.current = 1
    txRef.current = 0
    tyRef.current = 0
    setShowZoomBadge(false)
    if (zoomTimerRef.current) {
      clearTimeout(zoomTimerRef.current)
    }
    rerender()
  }, [rerender, src])

  useEffect(() => {
    return () => {
      if (zoomTimerRef.current) {
        clearTimeout(zoomTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const suppressClick = () => {
      suppressNextClickRef.current = true
    }

    window.addEventListener('image-context-menu-dismiss-lightbox-click', suppressClick)
    return () => window.removeEventListener('image-context-menu-dismiss-lightbox-click', suppressClick)
  }, [])

  const getCenter = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) {
      return { cx: 0, cy: 0 }
    }

    return {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
    }
  }, [])

  const apply = useCallback(
    (scale: number, tx: number, ty: number) => {
      const nextScale = clamp(scale, MIN_SCALE, MAX_SCALE)
      scaleRef.current = nextScale
      txRef.current = nextScale <= 1 ? 0 : tx
      tyRef.current = nextScale <= 1 ? 0 : ty

      if (nextScale > 1) {
        setShowZoomBadge(true)
        if (zoomTimerRef.current) {
          clearTimeout(zoomTimerRef.current)
        }
        zoomTimerRef.current = setTimeout(() => setShowZoomBadge(false), 1500)
      } else {
        setShowZoomBadge(false)
        if (zoomTimerRef.current) {
          clearTimeout(zoomTimerRef.current)
        }
      }

      rerender()
    },
    [rerender],
  )

  const zoomAtPoint = useCallback(
    (clientX: number, clientY: number, deltaY: number) => {
      const element = containerRef.current
      if (!element) return

      const scale = scaleRef.current
      const tx = txRef.current
      const ty = tyRef.current
      const rect = element.getBoundingClientRect()
      const mouseX = clientX - rect.left - rect.width / 2
      const mouseY = clientY - rect.top - rect.height / 2
      const factor = deltaY < 0 ? 1.15 : 1 / 1.15
      const nextScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE)
      const ratio = nextScale / scale

      apply(nextScale, mouseX - ratio * (mouseX - tx), mouseY - ratio * (mouseY - ty))
    },
    [apply],
  )

  const handleWheel: WheelEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      event.stopPropagation()
      event.preventDefault()
      zoomAtPoint(event.clientX, event.clientY, event.deltaY)
    },
    [zoomAtPoint],
  )

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return

      didDragRef.current = false
      if (scaleRef.current <= 1) return

      event.preventDefault()
      dragRef.current = {
        active: true,
        startX: event.clientX,
        startY: event.clientY,
        baseTx: txRef.current,
        baseTy: tyRef.current,
      }
    }

    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragRef.current
      if (!dragState.active) return

      const dx = event.clientX - dragState.startX
      const dy = event.clientY - dragState.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didDragRef.current = true
      }
      apply(scaleRef.current, dragState.baseTx + dx, dragState.baseTy + dy)
    }

    const handleMouseUp = () => {
      dragRef.current.active = false
    }

    element.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      element.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [apply])

  const handleClick: MouseEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false
        event.stopPropagation()
        return
      }

      if (didDragRef.current) return
      if (scaleRef.current > 1 && event.target instanceof HTMLImageElement) return
      onClose()
    },
    [onClose],
  )

  const handleDoubleClick: MouseEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      event.stopPropagation()
      if (scaleRef.current > 1) {
        apply(1, 0, 0)
        return
      }

      const { cx, cy } = getCenter()
      const mouseX = event.clientX - cx
      const mouseY = event.clientY - cy
      apply(3, -mouseX * 2, -mouseY * 2)
    },
    [apply, getCenter],
  )

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        event.preventDefault()
        hadMultiTouchRef.current = true
        tapRef.current = { time: 0, x: 0, y: 0 }
        const [pointA, pointB] = [event.touches[0], event.touches[1]]
        const distance = Math.hypot(pointA.clientX - pointB.clientX, pointA.clientY - pointB.clientY)
        const { cx, cy } = getCenter()

        pinchRef.current = {
          active: true,
          startDist: distance,
          startScale: scaleRef.current,
          startTx: txRef.current,
          startTy: tyRef.current,
          midX: (pointA.clientX + pointB.clientX) / 2 - cx,
          midY: (pointA.clientY + pointB.clientY) / 2 - cy,
        }
        dragRef.current.active = false
        return
      }

      if (event.touches.length !== 1) return

      const touch = event.touches[0]
      const now = Date.now()
      const previousTap = tapRef.current
      touchStartedOnImageRef.current = event.target instanceof HTMLImageElement

      if (
        now - previousTap.time < 300 &&
        Math.abs(touch.clientX - previousTap.x) < 30 &&
        Math.abs(touch.clientY - previousTap.y) < 30
      ) {
        event.preventDefault()
        if (scaleRef.current > 1) {
          apply(1, 0, 0)
        } else {
          const { cx, cy } = getCenter()
          const mouseX = touch.clientX - cx
          const mouseY = touch.clientY - cy
          apply(3, -mouseX * 2, -mouseY * 2)
        }
        tapRef.current = { time: 0, x: 0, y: 0 }
        return
      }

      tapRef.current = { time: now, x: touch.clientX, y: touch.clientY }
      if (scaleRef.current > 1 && touchStartedOnImageRef.current) {
        event.preventDefault()
        dragRef.current = {
          active: true,
          startX: touch.clientX,
          startY: touch.clientY,
          baseTx: txRef.current,
          baseTy: tyRef.current,
        }
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (pinchRef.current.active && event.touches.length === 2) {
        event.preventDefault()
        const [pointA, pointB] = [event.touches[0], event.touches[1]]
        const distance = Math.hypot(pointA.clientX - pointB.clientX, pointA.clientY - pointB.clientY)
        const pinchState = pinchRef.current
        const nextScale = clamp(
          pinchState.startScale * (distance / pinchState.startDist),
          MIN_SCALE,
          MAX_SCALE,
        )
        const ratio = nextScale / pinchState.startScale

        apply(
          nextScale,
          pinchState.midX - ratio * (pinchState.midX - pinchState.startTx),
          pinchState.midY - ratio * (pinchState.midY - pinchState.startTy),
        )
        return
      }

      if (dragRef.current.active && event.touches.length === 1) {
        event.preventDefault()
        const touch = event.touches[0]
        const dragState = dragRef.current

        apply(
          scaleRef.current,
          dragState.baseTx + touch.clientX - dragState.startX,
          dragState.baseTy + touch.clientY - dragState.startY,
        )
      }
    }

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        pinchRef.current.active = false
      }

      if (event.touches.length !== 0) return

      dragRef.current.active = false
      if (hadMultiTouchRef.current) {
        hadMultiTouchRef.current = false
        tapRef.current = { time: 0, x: 0, y: 0 }
        return
      }

      if (scaleRef.current <= 1 || !touchStartedOnImageRef.current) {
        const previousTap = tapRef.current
        if (previousTap.time > 0 && Date.now() - previousTap.time < 300) {
          setTimeout(() => {
            if (tapRef.current.time === previousTap.time) {
              onClose()
            }
          }, 310)
        }
      }
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: false })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd)
    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [apply, getCenter, onClose])

  const scale = scaleRef.current
  const tx = txRef.current
  const ty = tyRef.current
  const isZoomed = scale > 1
  const isDragging = dragRef.current.active || pinchRef.current.active
  const zoomPercent = Math.round(scale * 100)
  const imageStyle: CSSProperties = {
    transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
    transition: isDragging ? 'none' : 'transform 0.2s ease-out',
    willChange: 'transform',
  }

  return {
    containerRef,
    imageStyle,
    isZoomed,
    isDragging,
    showZoomBadge,
    zoomPercent,
    handleWheel,
    handleClick,
    handleDoubleClick,
  }
}
