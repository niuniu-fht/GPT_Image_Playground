import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../store'
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape'

export default function ConfirmDialog() {
  const confirmDialog = useStore((s) => s.confirmDialog)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const [isConfirming, setIsConfirming] = useState(false)
  const isConfirmingRef = useRef(false)

  const handleConfirm = async () => {
    if (!confirmDialog || isConfirmingRef.current) return
    isConfirmingRef.current = true
    setIsConfirming(true)
    try {
      await confirmDialog.action()
      setConfirmDialog(null)
    } finally {
      isConfirmingRef.current = false
      setIsConfirming(false)
    }
  }

  useCloseOnEscape(Boolean(confirmDialog) && !isConfirming, () => setConfirmDialog(null))

  if (!confirmDialog) return null

  const dialog = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      onClick={() => {
        if (!isConfirming) setConfirmDialog(null)
      }}
    >
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-md animate-overlay-in" />
      <div
        className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/50 dark:border-white/[0.08] rounded-3xl shadow-[0_8px_40px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgb(0,0,0,0.4)] max-w-sm w-full p-6 z-10 ring-1 ring-black/5 dark:ring-white/10 animate-confirm-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-2">
          {confirmDialog.title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{confirmDialog.message}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmDialog(null)}
            disabled={isConfirming}
            className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-white/[0.08] text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition"
          >
            取消
          </button>
          <button
            onClick={() => {
              void handleConfirm()
            }}
            disabled={isConfirming}
            className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isConfirming ? '处理中...' : confirmDialog.confirmText || '确认'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(dialog, document.body)
}
