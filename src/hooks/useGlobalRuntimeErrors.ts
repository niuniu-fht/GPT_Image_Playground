import { useEffect, useRef } from 'react'
import { useStore } from '../store'

const ERROR_TOAST_COOLDOWN_MS = 10_000
const GENERIC_RUNTIME_ERROR_MESSAGE = '系统遇到异常，请稍后重试；如果仍然失败，请刷新页面。'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return ''
}

function isIgnorableResourceError(event: ErrorEvent): boolean {
  const target = event.target
  if (!(target instanceof HTMLElement)) return false

  return ['IMG', 'SCRIPT', 'LINK', 'VIDEO', 'AUDIO'].includes(target.tagName)
}

function createRuntimeErrorKey(source: string, detail: string): string {
  return `${source}:${detail.slice(0, 160)}`
}

export function useGlobalRuntimeErrors() {
  const showToast = useStore((state) => state.showToast)
  const lastShownRef = useRef<{ key: string; shownAt: number } | null>(null)

  useEffect(() => {
    function showRuntimeErrorToast(key: string) {
      const now = Date.now()
      const lastShown = lastShownRef.current
      if (
        lastShown?.key === key &&
        now - lastShown.shownAt < ERROR_TOAST_COOLDOWN_MS
      ) {
        return
      }

      lastShownRef.current = { key, shownAt: now }
      showToast(GENERIC_RUNTIME_ERROR_MESSAGE, 'error')
    }

    function handleError(event: ErrorEvent) {
      if (isIgnorableResourceError(event)) return

      const detail = event.message || getErrorMessage(event.error) || 'window-error'
      console.error('[runtime-error]', event.error ?? event.message)
      showRuntimeErrorToast(createRuntimeErrorKey('error', detail))
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const detail = getErrorMessage(event.reason) || 'unhandled-rejection'
      console.error('[unhandled-rejection]', event.reason)
      showRuntimeErrorToast(createRuntimeErrorKey('promise', detail))
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [showToast])
}
