export function createAbortError(message = '任务已中止'): Error {
  const error = new Error(message)
  error.name = 'AbortError'
  return error
}

export function getAbortSignalMessage(signal: AbortSignal): string {
  const reason = signal.reason
  if (reason === 'timeout') {
    return '请求超时，已自动中止'
  }
  return '任务已中止'
}

export function throwIfSignalAborted(signal: AbortSignal, message?: string): void {
  if (signal.aborted) {
    throw createAbortError(message ?? getAbortSignalMessage(signal))
  }
}
