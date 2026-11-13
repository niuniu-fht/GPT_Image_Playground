/**
 * 全局 85% 缩放（html zoom）下，getBoundingClientRect / 事件 clientX/Y
 * 返回的是缩放后的 CSS 像素，而 window.innerWidth/innerHeight 是未缩放的真实像素。
 * 弹层定位必须统一使用缩放后的视口尺寸，否则会出现偏移。
 */
export function getCssZoom(): number {
  const zoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom || '')
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1
}

/** 与 rect / client 坐标同一坐标系的视口尺寸 */
export function getViewportSize(): { width: number; height: number } {
  const zoom = getCssZoom()
  return {
    width: window.innerWidth / zoom,
    height: window.innerHeight / zoom,
  }
}
