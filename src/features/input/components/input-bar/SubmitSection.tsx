import { useState } from 'react'
import type { ModelConfig } from '../../../../types'
import ButtonTooltip from './ButtonTooltip'

interface SubmitSectionProps {
  generationTargetLabel: string
  isLoggedIn: boolean
  activeModel: ModelConfig | null
  creditBalance: number
  estimatedCost: number
  canSubmit: boolean
  isMobile: boolean
  onSubmit: () => void
  onOpenSettings: () => void
}

export default function SubmitSection({
  generationTargetLabel,
  isLoggedIn,
  activeModel,
  creditBalance,
  estimatedCost,
  canSubmit,
  isMobile,
  onSubmit,
  onOpenSettings,
}: SubmitSectionProps) {
  const [submitHover, setSubmitHover] = useState(false)

  const isInsufficient = isLoggedIn && activeModel && creditBalance < estimatedCost

  return (
    <div className="mt-auto pt-4">
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
        <span>保存至</span>
        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
          {generationTargetLabel}
        </span>
        {activeModel && (
          <span className="ml-auto rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            消耗 {estimatedCost} 积分
          </span>
        )}
      </div>

      <div
        className="relative w-full"
        onMouseEnter={() => setSubmitHover(true)}
        onMouseLeave={() => setSubmitHover(false)}
      >
        <ButtonTooltip
          visible={submitHover && (!isLoggedIn || isInsufficient || !activeModel)}
          text={
            !isLoggedIn
              ? '请先登录后再生成'
              : !activeModel
                ? '暂无可用模型，请联系管理员配置'
                : '积分不足，无法生成'
          }
        />
        <button
          onClick={() => {
            if (isLoggedIn) {
              onSubmit()
            } else {
              onOpenSettings()
            }
          }}
          disabled={isLoggedIn ? !canSubmit : false}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium shadow-sm transition-all ${
            !isLoggedIn
              ? 'cursor-pointer bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-gray-950'
              : 'bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:opacity-50 dark:disabled:bg-white/[0.04]'
          }`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          {isLoggedIn ? (isMobile ? '生成图像' : '生成图像 (Ctrl+Enter)') : '登录后生成'}
        </button>
      </div>
    </div>
  )
}
