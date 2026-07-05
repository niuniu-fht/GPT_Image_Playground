import { useEffect, useRef, useState } from 'react'
import { renderModelIcon } from '../../../../lib/modelIcon'
import type { ModelConfig } from '../../../../types'

interface ModelSelectorProps {
  models: ModelConfig[]
  activeModelId: string | null
  compact: boolean
  onChange: (modelId: string) => void
}

export default function ModelSelector({
  models,
  activeModelId,
  compact,
  onChange,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const activeModel = models.find((model) => model.id === activeModelId) ?? models[0] ?? null

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center gap-3 rounded-2xl border border-gray-200/80 bg-white px-3 text-left shadow-sm transition hover:border-gray-300 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.07] ${
          compact ? 'py-2.5' : 'py-3'
        }`}
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
            {activeModel ? `${activeModel.costCredits} 积分 / 次 · ${activeModel.description}` : '请联系管理员配置模型'}
          </span>
        </span>
        <svg className={`h-4 w-4 text-gray-500 transition ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-80 overflow-y-auto rounded-2xl border border-gray-200/90 bg-white p-2 shadow-2xl shadow-gray-900/12 dark:border-white/[0.08] dark:bg-gray-900">
          {models.map((model) => {
            const selected = model.id === activeModel?.id
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => {
                  onChange(model.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
                  selected
                    ? 'bg-slate-100 dark:bg-white/[0.08]'
                    : 'hover:bg-gray-50 dark:hover:bg-white/[0.05]'
                }`}
              >
                {renderModelIcon(model.icon)}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {model.displayName}
                    </span>
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-400 dark:bg-white/[0.06]">
                      积分 {model.costCredits}
                    </span>
                    {model.isNew && (
                      <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                        新
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-gray-400 dark:text-gray-500">
                    {model.description}
                  </span>
                </span>
                {selected && (
                  <svg className="h-4 w-4 flex-shrink-0 text-gray-800 dark:text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="m5 13 4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
