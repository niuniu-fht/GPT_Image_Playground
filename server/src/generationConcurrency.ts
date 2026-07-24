import { env } from './env.js'

interface SemaphoreWaiter {
  signal?: AbortSignal
  resolve: (release: () => void) => void
  reject: (error: Error) => void
  onAbort?: () => void
}

class AsyncSemaphore {
  private active = 0
  private readonly queue: SemaphoreWaiter[] = []

  constructor(readonly limit: number) {}

  async run<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const release = await this.acquire(signal)
    try {
      return await operation()
    } finally {
      release()
    }
  }

  snapshot() {
    return {
      active: this.active,
      queued: this.queue.length,
      limit: this.limit,
    }
  }

  private acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) {
      return Promise.reject(this.abortError())
    }

    if (this.active < this.limit) {
      this.active += 1
      return Promise.resolve(this.createRelease())
    }

    return new Promise((resolve, reject) => {
      const waiter: SemaphoreWaiter = { signal, resolve, reject }
      if (signal) {
        waiter.onAbort = () => {
          const index = this.queue.indexOf(waiter)
          if (index >= 0) this.queue.splice(index, 1)
          reject(this.abortError())
        }
        signal.addEventListener('abort', waiter.onAbort, { once: true })
      }
      this.queue.push(waiter)
    })
  }

  private createRelease(): () => void {
    let released = false
    return () => {
      if (released) return
      released = true
      this.active = Math.max(0, this.active - 1)
      this.drain()
    }
  }

  private drain() {
    while (this.active < this.limit && this.queue.length > 0) {
      const waiter = this.queue.shift()!
      if (waiter.signal?.aborted) {
        waiter.reject(this.abortError())
        continue
      }
      if (waiter.signal && waiter.onAbort) {
        waiter.signal.removeEventListener('abort', waiter.onAbort)
      }
      this.active += 1
      waiter.resolve(this.createRelease())
    }
  }

  private abortError(): Error {
    const error = new Error('任务等待并发槽位时已中止')
    error.name = 'AbortError'
    return error
  }
}

const upstreamSemaphore = new AsyncSemaphore(env.generationUpstreamConcurrency)
const previewSemaphore = new AsyncSemaphore(env.generationPreviewConcurrency)

export function withGenerationUpstreamSlot<T>(
  signal: AbortSignal,
  operation: () => Promise<T>,
): Promise<T> {
  return upstreamSemaphore.run(operation, signal)
}

export function withGenerationPreviewSlot<T>(
  operation: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  return previewSemaphore.run(operation, signal)
}

export function getGenerationConcurrencySnapshot() {
  return {
    upstream: upstreamSemaphore.snapshot(),
    preview: previewSemaphore.snapshot(),
  }
}
