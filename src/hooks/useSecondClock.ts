import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let currentTime = Date.now()
let timerId: number | null = null

function emitTick() {
  currentTime = Date.now()
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (timerId == null) {
    currentTime = Date.now()
    timerId = window.setInterval(emitTick, 1000)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timerId != null) {
      window.clearInterval(timerId)
      timerId = null
    }
  }
}

function subscribeDisabled(): () => void {
  return () => undefined
}

function getSnapshot(): number {
  return currentTime
}

export function useSecondClock(enabled = true): number {
  return useSyncExternalStore(
    enabled ? subscribe : subscribeDisabled,
    getSnapshot,
    getSnapshot,
  )
}
