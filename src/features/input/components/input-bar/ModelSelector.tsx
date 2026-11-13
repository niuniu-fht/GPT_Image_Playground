import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { resolveEffectiveModelQuality, resolveFirstAvailableCombination, resolveModelCostForSize } from '../../../../lib/modelCost'
import { resolveImageSizeTier } from '../../../../lib/size'
import { renderModelIcon, SeedreamBrandIcon, BrandGptIcon, BrandGeminiIcon } from '../../../../lib/modelIcon'
import { getCssZoom, getViewportSize } from '../../../../lib/viewport'
import type { ModelConfig, TaskParams } from '../../../../types'

interface ModelSelectorProps {
  models: ModelConfig[]
  activeModelId: string | null
  compact: boolean
  params: TaskParams
  onChange: (modelId: string) => void
}

interface MenuPosition {
  left: number
  top?: number
  bottom?: number
  width: number
  maxHeight: number
}

const MENU_MAX_HEIGHT = 500
const MENU_GAP = 8
const MIN_USABLE_SPACE = 160

const GROUP_ORDER = ['GPT', 'Gemini', 'Grok', 'Seedream']
const UNGROUPED_LABEL = '其他'

interface GroupMeta {
  logo: ReactNode
  bg?: string
}

const GROUP_META: Record<string, GroupMeta> = {
  gpt: { logo: <BrandGptIcon className="h-4 w-4" /> },
  gemini: { logo: <BrandGeminiIcon className="h-4 w-4" /> },
  grok: { logo: '𝕏', bg: 'bg-slate-900 dark:bg-slate-700' },
  seedream: { logo: <SeedreamBrandIcon className="h-4 w-4" /> },
}

function groupLogo(name: string) {
  const meta = GROUP_META[name.toLowerCase()]
  if (meta?.bg) {
    return (
      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded text-[9px] font-bold text-white ${meta.bg}`}>
        {meta.logo}
      </span>
    )
  }
  if (meta) {
    return <span className="shrink-0">{meta.logo}</span>
  }
  return (
    <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-gray-200 text-[9px] font-bold text-gray-500 dark:bg-white/[0.1] dark:text-gray-300">
      {name.charAt(0) || '•'}
    </span>
  )
}

export default function ModelSelector({
  models,
  activeModelId,
  compact,
  params,
  onChange,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const activeModel = models.find((model) => model.id === activeModelId) ?? models[0] ?? null
  const activeQuality = resolveEffectiveModelQuality(activeModel, params.quality, params.size)
  const activeModelCost = activeModel
    ? resolveModelCostForSize(activeModel, params.size, activeQuality) * Math.max(1, Math.floor(params.n))
    : 0
  const activeTier = resolveImageSizeTier(params.size)
  const activeQualityLabel = activeQuality === 'low' ? '低' : activeQuality === 'medium' ? '中' : activeQuality === 'high' ? '高' : activeQuality === 'xhigh' ? '极高' : '最高'

  const groups = useMemo(() => {
    const map = new Map<string, ModelConfig[]>()
    for (const model of models) {
      const key = (model.group ?? '').trim() || UNGROUPED_LABEL
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(model)
    }
    return Array.from(map.entries())
      .map(([name, groupModels]) => ({ name, models: groupModels }))
      .sort((left, right) => {
        const leftIndex = GROUP_ORDER.indexOf(left.name)
        const rightIndex = GROUP_ORDER.indexOf(right.name)
        return (leftIndex === -1 ? GROUP_ORDER.length + 1 : leftIndex) - (rightIndex === -1 ? GROUP_ORDER.length + 1 : rightIndex)
      })
  }, [models])

  // 选中的分组（null = 全部）；分组过滤 tab 让用户一次只看一组，避免列表过长
  const visibleGroups = useMemo(() => {
    if (!groupFilter) return groups
    return groups.filter((group) => group.name === groupFilter)
  }, [groups, groupFilter])

  const updatePosition = useCallback(() => {
    const visualRect = rootRef.current?.getBoundingClientRect()
    if (!visualRect) return
    // 85% 缩放：rect 是视觉像素，fixed 弹层样式是缩放空间像素，统一 ÷ zoom
    const zoom = getCssZoom()
    const rect = {
      left: visualRect.left / zoom,
      top: visualRect.top / zoom,
      bottom: visualRect.bottom / zoom,
      width: visualRect.width / zoom,
    }
    const viewport = getViewportSize()
    const spaceBelow = viewport.height - rect.bottom - MENU_GAP * 2
    const spaceAbove = rect.top - MENU_GAP * 2
    const openUpward = spaceBelow < MIN_USABLE_SPACE && spaceAbove > spaceBelow
    const maxHeight = Math.min(MENU_MAX_HEIGHT, Math.max(MIN_USABLE_SPACE, openUpward ? spaceAbove : spaceBelow))
    setPosition(openUpward
      ? { left: rect.left, bottom: viewport.height - rect.top + MENU_GAP, width: rect.width, maxHeight }
      : { left: rect.left, top: rect.bottom + MENU_GAP, width: rect.width, maxHeight })
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    // 面板内部滚动会移动触发按钮，用捕获阶段监听所有滚动容器
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    // 打开时把选中项滚动到可视区
    const selected = menuRef.current?.querySelector('[data-selected="true"]')
    selected?.scrollIntoView({ block: 'nearest' })
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-2xl border border-gray-200/80 bg-white px-3 text-left shadow-sm transition hover:border-gray-300 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.07] ${
          compact ? 'py-2.5' : 'py-3'
        } ${open ? 'border-gray-300 ring-2 ring-slate-900/[0.06] dark:border-white/[0.14] dark:ring-white/[0.08]' : ''}`}
      >
        {activeModel ? renderModelIcon(activeModel.icon) : renderModelIcon('sparkles')}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {activeModel?.displayName ?? '暂无可用模型'}
            </span>
            {activeModel?.isNew && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                新
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-gray-400 dark:text-gray-500">
            {activeModel
              ? `本次 ${activeModelCost} 积分 · ${activeQualityLabel} / ${activeTier} / ${Math.max(1, Math.floor(params.n))} 张`
              : '请联系管理员配置模型'}
          </span>
        </span>
        <svg className={`h-4 w-4 shrink-0 text-gray-500 transition ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && position && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          style={{
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
            ...(position.top !== undefined ? { top: position.top } : { bottom: position.bottom }),
          }}
          className="fixed z-[120] overflow-y-auto overscroll-contain rounded-2xl border border-gray-200/90 bg-white p-1.5 shadow-2xl shadow-gray-900/15 ring-1 ring-black/[0.02] dark:border-white/[0.08] dark:bg-gray-900 dark:shadow-black/40 dark:ring-white/[0.04] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-white/[0.14]"
        >
          <div className="sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b border-gray-100 bg-white/95 px-1.5 pb-1.5 pt-1 backdrop-blur dark:border-white/[0.06] dark:bg-gray-900/95">
            {[{ name: null, label: '全部', count: models.length }, ...groups.map((group) => ({ name: group.name, label: group.name, count: group.models.length }))].map((chip) => {
              const active = (chip.name ?? null) === groupFilter
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setGroupFilter(chip.name ?? null)}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
                    active
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-gray-950'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-400 dark:hover:bg-white/[0.1]'
                  }`}
                >
                  {chip.label}
                  <span className="ml-1 tabular-nums opacity-60">{chip.count}</span>
                </button>
              )
            })}
          </div>
          {visibleGroups.map((group) => (
            <div key={group.name} className="mb-2 last:mb-1">
              {groupFilter ? null : (
                <div className="sticky top-[30px] z-10 flex items-center gap-1.5 bg-white/95 px-2.5 py-1.5 backdrop-blur dark:bg-gray-900/95">
                  {groupLogo(group.name)}
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {group.name}
                  </span>
                  <span className="text-[11px] tabular-nums text-gray-300 dark:text-gray-600">{group.models.length}</span>
                  <span className="ml-1 h-px flex-1 bg-gray-100 dark:bg-white/[0.06]" />
                </div>
              )}
              {group.models.map((model) => {
                const selected = model.id === activeModel?.id
                const starter = resolveFirstAvailableCombination(model)
                const starterSize = starter.tier === '1K' ? '1024x1024' : starter.tier === '2K' ? '2048x2048' : '3840x3840'
                const modelCost = resolveModelCostForSize(model, starterSize, starter.quality)
                return (
                  <button
                    key={model.id}
                    type="button"
                    data-selected={selected}
                    onClick={() => {
                      onChange(model.id)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 pl-2.5 text-left transition ${
                      selected
                        ? 'bg-slate-100/90 ring-1 ring-slate-200 dark:bg-white/[0.08] dark:ring-white/[0.08]'
                        : 'hover:bg-gray-50 dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="shrink-0">{renderModelIcon(model.icon, 'h-7 w-7')}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold leading-5 text-gray-800 dark:text-gray-100">
                          {model.displayName}
                        </span>
                        {model.isNew && (
                          <span className="shrink-0 rounded-full bg-rose-500 px-1 py-0.5 text-[9px] font-semibold leading-none text-white">
                            新
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] leading-4 text-gray-400 dark:text-gray-500">
                        {model.description}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
                        {modelCost} 积分起
                      </span>
                      <svg
                        className={`h-3.5 w-3.5 text-slate-700 dark:text-gray-100 ${selected ? '' : 'invisible'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="m5 13 4 4L19 7" />
                      </svg>
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
