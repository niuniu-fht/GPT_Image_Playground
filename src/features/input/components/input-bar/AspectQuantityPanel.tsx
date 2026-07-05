import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  calculateImageSize,
  normalizeImageSize,
  resolveImageSizeTier,
  type SizeTier,
} from '../../../../lib/size'
import type { TaskParams } from '../../../../types'

type AspectOption = {
  label: string
  ratio: string
}

const ASPECT_OPTIONS: AspectOption[] = [
  { label: '1:1', ratio: '1:1' },
  { label: '16:9', ratio: '16:9' },
  { label: '9:16', ratio: '9:16' },
  { label: '4:3', ratio: '4:3' },
  { label: '3:4', ratio: '3:4' },
  { label: '3:2', ratio: '3:2' },
  { label: '2:3', ratio: '2:3' },
  { label: '5:4', ratio: '5:4' },
  { label: '4:5', ratio: '4:5' },
  { label: '21:9', ratio: '21:9' },
]

const QUANTITY_OPTIONS = [1, 2, 3, 4] as const
const SIZE_TIER_OPTIONS: SizeTier[] = ['1K', '2K', '4K']
const DEFAULT_RATIO = '1:1'
const FLOATING_PANEL_GAP = 8
const FLOATING_PANEL_WIDTH = 322
const FLOATING_PANEL_ESTIMATED_HEIGHT = 326
const FLOATING_PANEL_SCREEN_PADDING = 12

interface FloatingPanelStyle {
  left: number
  maxHeight: number
  top: number
  width: number
}

interface AspectQuantityPanelProps {
  estimatedCost: number
  normalizedSize: string
  params: TaskParams
  onSetParams: (params: Partial<TaskParams>) => void
}

function resolveActiveRatio(size: string): string | null {
  const normalized = normalizeImageSize(size)
  if (!normalized || normalized === 'auto') return null

  return ASPECT_OPTIONS.find((option) => (
    SIZE_TIER_OPTIONS.some((tier) => calculateImageSize(tier, option.ratio) === normalized)
  ))?.ratio ?? null
}

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(' ')
}

function ratioIconSize(ratio: string): { width: number; height: number } {
  const [rawWidth, rawHeight] = ratio.split(':').map(Number)
  if (!rawWidth || !rawHeight) return { width: 16, height: 16 }
  const longRatio = Math.max(rawWidth, rawHeight) / Math.min(rawWidth, rawHeight)
  if (longRatio >= 2) {
    return rawWidth > rawHeight ? { width: 18, height: 7 } : { width: 8, height: 18 }
  }
  if (rawWidth > rawHeight) return { width: 18, height: 11 }
  if (rawHeight > rawWidth) return { width: 11, height: 18 }
  return { width: 16, height: 16 }
}

function RatioIcon({ active, ratio }: { active: boolean; ratio: string }) {
  const iconSize = ratioIconSize(ratio)
  return (
    <span
      className={cx(
        'inline-block shrink-0 rounded-[4px] border transition',
        active
          ? 'border-slate-950 bg-white shadow-[inset_0_0_0_3px_white] dark:border-white dark:bg-slate-950'
          : 'border-slate-400 bg-white dark:border-slate-500 dark:bg-slate-900',
      )}
      style={{ width: iconSize.width, height: iconSize.height }}
      aria-hidden="true"
    />
  )
}

function ImageCountIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 19.25h11.5a2.75 2.75 0 0 0 2.75-2.75V7.75A2.75 2.75 0 0 0 16.5 5H7.75A2.75 2.75 0 0 0 5 7.75v11.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m7.5 16.5 2.5-2.75a1.2 1.2 0 0 1 1.78 0l1.08 1.17 1.42-1.68a1.2 1.2 0 0 1 1.84 0l2.1 2.56"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
    </svg>
  )
}

function buttonClass(active: boolean) {
  return cx(
    'h-8 rounded-lg border text-[13px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-white/20',
    active
      ? 'border-slate-950 bg-white text-slate-950 shadow-sm dark:border-white dark:bg-slate-900 dark:text-white'
      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-white/[0.1] dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-white/[0.06]',
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export default function AspectQuantityPanel({
  estimatedCost,
  normalizedSize,
  params,
  onSetParams,
}: AspectQuantityPanelProps) {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<FloatingPanelStyle | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const summaryRef = useRef<HTMLButtonElement | null>(null)
  const activeRatio = resolveActiveRatio(params.size) ?? resolveActiveRatio(normalizedSize)
  const activeTier = resolveImageSizeTier(params.size)
  const quantity = Math.min(Math.max(Math.round(params.n || 1), 1), 4)
  const summaryRatio = params.size === 'auto' || !activeRatio ? '自动' : activeRatio

  useLayoutEffect(() => {
    if (!open) return

    const rect = summaryRef.current?.getBoundingClientRect()
    if (!rect) return

    const width = Math.min(
      window.innerWidth - FLOATING_PANEL_SCREEN_PADDING * 2,
      Math.max(rect.width, FLOATING_PANEL_WIDTH),
    )
    const left = clamp(
      rect.left,
      FLOATING_PANEL_SCREEN_PADDING,
      window.innerWidth - width - FLOATING_PANEL_SCREEN_PADDING,
    )
    const availableTop = rect.top - FLOATING_PANEL_GAP - FLOATING_PANEL_SCREEN_PADDING
    const maxHeight = Math.max(220, Math.min(FLOATING_PANEL_ESTIMATED_HEIGHT, availableTop))
    const top = Math.max(FLOATING_PANEL_SCREEN_PADDING, rect.top - FLOATING_PANEL_GAP - maxHeight)

    setPanelStyle({ left, maxHeight, top, width })
  }, [open])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null
      if (!target) return
      if (summaryRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const selectRatio = (ratio: string) => {
    const size = calculateImageSize(activeTier, ratio)
    if (size) onSetParams({ size })
  }

  const selectTier = (tier: SizeTier) => {
    const size = calculateImageSize(tier, activeRatio ?? DEFAULT_RATIO)
    if (size) onSetParams({ size })
  }

  const panel = open && panelStyle
    ? createPortal(
        <div
          ref={panelRef}
          data-testid="aspect-quantity-floating-panel"
          className="fixed z-[120] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] ring-1 ring-black/[0.03] dark:border-white/[0.08] dark:bg-slate-950 dark:ring-white/[0.06]"
          style={{
            left: panelStyle.left,
            maxHeight: panelStyle.maxHeight,
            top: panelStyle.top,
            width: panelStyle.width,
          }}
        >
          <div className="max-h-[inherit] space-y-2.5 overflow-y-auto overscroll-contain p-3">
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">宽高比</div>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => onSetParams({ size: 'auto' })}
                  className={buttonClass(params.size === 'auto')}
                >
                  自动
                </button>
                {ASPECT_OPTIONS.map((option) => {
                  const active = activeRatio === option.ratio && params.size !== 'auto'
                  return (
                    <button
                      key={option.ratio}
                      type="button"
                      onClick={() => selectRatio(option.ratio)}
                      className={cx('flex min-w-0 items-center justify-center gap-1 px-1.5', buttonClass(active))}
                    >
                      <RatioIcon active={active} ratio={option.ratio} />
                      <span>{option.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">图像分辨率</div>
              <div className="grid grid-cols-3 gap-2">
                {SIZE_TIER_OPTIONS.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => selectTier(tier)}
                    className={buttonClass(activeTier === tier)}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">图片数量</div>
              <div className="grid grid-cols-4 gap-2">
                {QUANTITY_OPTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onSetParams({ n: item })}
                    className={buttonClass(quantity === item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">
              当前预计消耗 {estimatedCost} 积分
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <section>
      <button
        type="button"
        ref={summaryRef}
        data-testid="aspect-quantity-summary"
        onClick={() => setOpen((value) => !value)}
        className="grid h-9 w-full grid-cols-[1fr_auto_1fr_auto_1fr] items-center rounded-lg bg-slate-50 px-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:bg-white/[0.04] dark:text-slate-100 dark:hover:bg-white/[0.08] dark:focus:ring-white/20"
        aria-expanded={open}
        aria-label="选择宽高比、图片数量和图像分辨率"
      >
        <span className="text-center">{summaryRatio}</span>
        <span className="h-6 w-px bg-slate-300 dark:bg-white/[0.14]" />
        <span className="inline-flex items-center justify-center gap-1.5 text-center">
          <ImageCountIcon />
          {quantity}
        </span>
        <span className="h-6 w-px bg-slate-300 dark:bg-white/[0.14]" />
        <span className="text-center">{activeTier}</span>
      </button>
      {panel}
    </section>
  )
}
