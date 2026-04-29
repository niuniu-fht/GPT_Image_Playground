import type { ReactNode } from 'react'

interface MobilePromptDrawerProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export default function MobilePromptDrawer({ open, onClose, children }: MobilePromptDrawerProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end md:hidden">
      <div
        className="animate-overlay-in absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="animate-slide-up relative flex h-[92vh] w-full flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl dark:bg-gray-900">
        <div className="sticky top-0 z-10 flex flex-col items-center border-b border-gray-100 bg-white/95 px-4 pb-4 pt-3 backdrop-blur-sm dark:border-white/[0.08] dark:bg-gray-900/95">
          <div className="mb-3 h-1 w-12 rounded-full bg-gray-200 dark:bg-white/[0.12]" />
          <div className="flex w-full items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800 dark:text-gray-200">提示词与参数</h3>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">在这里完成输入、参考图和参数设置</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
