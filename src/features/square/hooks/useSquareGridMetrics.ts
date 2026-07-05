import { useLayoutEffect, useState, type RefObject } from 'react'

export interface SquareGridMetrics {
  columnCount: number
  columnWidth: number
  gap: number
  rowHeight: number
}

const DEFAULT_GRID_METRICS: SquareGridMetrics = {
  columnCount: 1,
  columnWidth: 360,
  gap: 16,
  rowHeight: 12,
}

function parsePixelValue(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function readGridMetrics(element: HTMLDivElement): SquareGridMetrics {
  const style = window.getComputedStyle(element)
  const columns = style.gridTemplateColumns
    .split(' ')
    .map(parsePixelValue)
    .filter((value) => value > 0)
  const gap = parsePixelValue(style.columnGap || style.gap) || DEFAULT_GRID_METRICS.gap
  const rowHeight = parsePixelValue(style.gridAutoRows) || DEFAULT_GRID_METRICS.rowHeight
  const columnCount = Math.max(1, columns.length || DEFAULT_GRID_METRICS.columnCount)
  const fallbackColumnWidth = Math.max(
    DEFAULT_GRID_METRICS.columnWidth,
    (element.clientWidth - gap * (columnCount - 1)) / columnCount,
  )

  return {
    columnCount,
    columnWidth: columns[0] ?? fallbackColumnWidth,
    gap,
    rowHeight,
  }
}

function areMetricsEqual(left: SquareGridMetrics, right: SquareGridMetrics): boolean {
  return (
    left.columnCount === right.columnCount &&
    left.columnWidth === right.columnWidth &&
    left.gap === right.gap &&
    left.rowHeight === right.rowHeight
  )
}

export function useSquareGridMetrics(gridRef: RefObject<HTMLDivElement | null>): SquareGridMetrics {
  const [metrics, setMetrics] = useState<SquareGridMetrics>(DEFAULT_GRID_METRICS)

  useLayoutEffect(() => {
    const element = gridRef.current
    if (!element) return undefined

    const updateMetrics = () => {
      const nextMetrics = readGridMetrics(element)
      setMetrics((currentMetrics) => (
        areMetricsEqual(currentMetrics, nextMetrics) ? currentMetrics : nextMetrics
      ))
    }

    updateMetrics()
    const observer = new ResizeObserver(updateMetrics)
    observer.observe(element)
    return () => observer.disconnect()
  })

  return metrics
}
