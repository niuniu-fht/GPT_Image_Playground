import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BatchQueueState, BatchQueueEntry } from '../batchQueue'

const mocks = vi.hoisted(() => ({
  prepareCurrentTaskDraft: vi.fn(),
  enqueueTaskRun: vi.fn(),
  executeTask: vi.fn(),
  getAllTasks: vi.fn(),
  putTask: vi.fn(),
  deleteTask: vi.fn(),
  storeState: {
    tasks: [] as Array<Record<string, unknown>>,
    providers: [] as unknown[],
    settings: {},
    categories: [],
    activeProviderId: '',
    activeCategoryFilter: '',
    currentUser: { id: 'u1', creditBalance: 9999 },
    activeModelId: 'm1',
    models: [{ id: 'm1', costCredits: 1 }],
    params: {},
  },
}))

vi.mock('../taskDraft', () => ({ prepareCurrentTaskDraft: mocks.prepareCurrentTaskDraft }))
vi.mock('../taskRun', () => ({ enqueueTaskRun: mocks.enqueueTaskRun }))
vi.mock('../taskExecutor', () => ({ executeTask: mocks.executeTask }))
vi.mock('../../lib/db', () => ({
  getAllTasks: mocks.getAllTasks,
  putTask: mocks.putTask,
  deleteTask: mocks.deleteTask,
}))
vi.mock('../domain', () => ({
  findProviderById: () => null,
  getProviderSettings: () => ({ baseUrl: 'http://test' }),
}))
vi.mock('../state', () => ({
  useStore: { getState: () => mocks.storeState },
}))

const STORAGE_KEY = 'batch-generation-queue-v1'

function createMemoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  }
}

function makeTaskRecord(id: string, prompt: string, generationTaskId: string | null = null) {
  return {
    id,
    taskKind: 'generation',
    generationRequestId: id,
    generationTaskId,
    generationTimeoutSeconds: null,
    prompt,
    params: { size: '1024x1024', quality: 'medium', n: 1 },
    inputImageIds: [],
    outputImages: [],
    status: 'running',
    error: null,
    createdAt: Date.now(),
    finishedAt: null,
    elapsed: null,
    providerId: null,
  }
}

function readQueue(): BatchQueueState | null {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  return raw ? (JSON.parse(raw) as BatchQueueState) : null
}

function writeQueue(queue: BatchQueueState | null) {
  if (!queue) window.localStorage.removeItem(STORAGE_KEY)
  else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

function makeEntry(partial: Partial<BatchQueueEntry> & { id: string; seq: number }): BatchQueueEntry {
  return {
    prompt: `p-${partial.seq}`,
    size: '1024x1024',
    quality: 'medium',
    status: 'queued',
    taskId: null,
    resumeTaskId: null,
    error: null,
    ...partial,
  }
}

async function waitUntil(predicate: () => boolean, label: string, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitUntil timeout: ${label}; queue=${JSON.stringify(readQueue())}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

interface Deferred {
  promise: Promise<void>
  resolve: () => void
}

function createDeferred(): Deferred {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

/** 挂起的 executeTask deferred；断言失败时 afterEach 统一释放，避免 runner 卡死污染后续用例 */
let activeDeferreds: Deferred[] = []

function trackDeferred(): Deferred {
  const deferred = createDeferred()
  activeDeferreds.push(deferred)
  return deferred
}

describe('batchQueue', () => {
  let batchQueue: typeof import('../batchQueue')

  beforeAll(async () => {
    batchQueue = await import('../batchQueue')
  })

  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: createMemoryStorage() })
    mocks.prepareCurrentTaskDraft.mockReset()
    mocks.enqueueTaskRun.mockReset().mockResolvedValue(undefined)
    mocks.executeTask.mockReset().mockResolvedValue(undefined)
    mocks.getAllTasks.mockReset().mockResolvedValue([])
    mocks.putTask.mockReset().mockResolvedValue(undefined)
    mocks.deleteTask.mockReset().mockResolvedValue(undefined)
    mocks.storeState.tasks = []
  })

  afterEach(async () => {
    for (const deferred of activeDeferreds) deferred.resolve()
    activeDeferreds = []
    await waitUntil(() => {
      const queue = readQueue()
      return !queue || queue.status !== 'running'
    }, 'runner drain in afterEach', 2000).catch(() => undefined)
  })

  afterAll(async () => {
    for (const deferred of activeDeferreds) deferred.resolve()
  })

  it('20 条并发执行：每条只认领一次、并发不超过 9、全部完成', async () => {
    const prompts = Array.from({ length: 20 }, (_, i) => `提示词-${i + 1}`)
    const submitCount = new Map<string, number>()
    let inFlight = 0
    let maxInFlight = 0

    mocks.prepareCurrentTaskDraft.mockImplementation(async (snapshot: { prompt: string }) => ({
      ok: true as const,
      draft: {
        task: makeTaskRecord(`task-${snapshot.prompt}`, snapshot.prompt),
        requestSettings: {},
      },
    }))
    mocks.enqueueTaskRun.mockImplementation(async (task: { prompt: string }) => {
      submitCount.set(task.prompt, (submitCount.get(task.prompt) ?? 0) + 1)
    })
    mocks.executeTask.mockImplementation(async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 10))
      inFlight -= 1
    })

    const queueId = batchQueue.startBatchQueue(prompts, { size: '1024x1024', quality: 'medium' })
    expect(queueId).toBeTruthy()

    await waitUntil(() => readQueue()?.status !== 'running', 'batch finish')

    const queue = readQueue()
    expect(queue?.status).toBe('done')
    expect(queue?.entries.every((entry) => entry.status === 'done')).toBe(true)
    expect(submitCount.size).toBe(20)
    for (const [, count] of submitCount) {
      expect(count).toBe(1)
    }
    expect(maxInFlight).toBeLessThanOrEqual(9)
    expect(maxInFlight).toBeGreaterThan(1)
  })

  it('并发认领不互相覆盖：5 条在生成中时 taskId 全部保留（过期快照写回回归）', async () => {
    mocks.prepareCurrentTaskDraft.mockImplementation(async (snapshot: { prompt: string }) => ({
      ok: true as const,
      draft: {
        task: makeTaskRecord(`task-${snapshot.prompt}`, snapshot.prompt),
        requestSettings: {},
      },
    }))
    mocks.executeTask.mockImplementation(() => trackDeferred().promise)

    batchQueue.startBatchQueue(
      Array.from({ length: 5 }, (_, i) => `并发-${i + 1}`),
      { size: '1024x1024', quality: 'medium' },
    )

    await waitUntil(() => {
      const queue = readQueue()
      return Boolean(queue && queue.entries.every((entry) => entry.taskId))
    }, 'all taskIds recorded')

    const queue = readQueue()
    expect(queue?.status).toBe('running')
    const taskIds = queue!.entries.map((entry) => entry.taskId)
    expect(new Set(taskIds).size).toBe(5)
    expect(queue!.entries.every((entry) => entry.status === 'generating')).toBe(true)
  })

  it('取消剩余任务：已生成的完成，排队中的标记取消，批次落 partial_failed', async () => {
    mocks.prepareCurrentTaskDraft.mockImplementation(async (snapshot: { prompt: string }) => ({
      ok: true as const,
      draft: {
        task: makeTaskRecord(`task-${snapshot.prompt}`, snapshot.prompt),
        requestSettings: {},
      },
    }))
    const held: Deferred[] = []
    mocks.executeTask.mockImplementation(() => {
      const deferred = trackDeferred()
      held.push(deferred)
      return deferred.promise
    })

    // 12 条 + 并发 9：前 9 条进入生成中，其余 3 条保持排队，取消后应标记为已取消
    batchQueue.startBatchQueue(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'],
      { size: '1024x1024', quality: 'medium' },
    )

    await waitUntil(() => (readQueue()?.entries.filter((entry) => entry.status === 'generating').length ?? 0) >= 9, 'nine claimed')

    const cancelled = batchQueue.cancelBatchQueue()
    expect(cancelled?.entries.filter((entry) => entry.status === 'cancelled').length).toBe(3)

    // 放行生成中的 9 条，等待批次收尾
    for (const deferred of held) deferred.resolve()
    await waitUntil(() => readQueue()?.status !== 'running', 'finalize after cancel')

    const queue = readQueue()
    expect(queue?.status).toBe('partial_failed')
    expect(queue?.entries.filter((entry) => entry.status === 'done').length).toBe(9)
    expect(queue?.entries.filter((entry) => entry.status === 'cancelled').length).toBe(3)
    expect(queue?.entries.every((entry) => entry.status !== 'queued')).toBe(true)
  })

  it('刷新恢复：已提交上游的条目走 resumeTaskId 等待原任务，不重复生成', async () => {
    const submitted = makeTaskRecord('t1', '已提交的提示词', 'srv-1')
    mocks.getAllTasks.mockResolvedValue([submitted])
    mocks.storeState.tasks = [submitted]
    const preparedPrompts: string[] = []
    mocks.prepareCurrentTaskDraft.mockImplementation(async (snapshot: { prompt: string }) => {
      preparedPrompts.push(snapshot.prompt)
      return {
        ok: true as const,
        draft: {
          task: makeTaskRecord(`task-${snapshot.prompt}`, snapshot.prompt),
          requestSettings: {},
        },
      }
    })
    const executeIds: string[] = []
    mocks.executeTask.mockImplementation(async (taskId: string) => {
      executeIds.push(taskId)
      if (taskId === 't1') submitted.status = 'done'
    })

    writeQueue({
      id: 'bq-resume',
      name: 'resume',
      createdAt: Date.now(),
      status: 'running',
      entries: [
        makeEntry({ id: 'e1', seq: 1, status: 'generating', taskId: 't1', prompt: '已提交的提示词' }),
        makeEntry({ id: 'e2', seq: 2, prompt: '普通提示词' }),
      ],
    })

    batchQueue.resumeBatchQueueIfAny('models')
    batchQueue.resumeBatchQueueIfAny('tasks')

    await waitUntil(() => readQueue()?.status === 'done', 'resume finish')

    const queue = readQueue()
    expect(queue?.entries[0].status).toBe('done')
    expect(queue?.entries[0].taskId).toBe('t1')
    expect(executeIds).toContain('t1')
    // 已提交条目不得重新走草稿管线（避免重复扣费）
    expect(preparedPrompts).not.toContain('已提交的提示词')
    expect(preparedPrompts).toContain('普通提示词')
  })

  it('刷新恢复：未提交上游的孤儿草稿被删除并重新排队生成', async () => {
    const orphan = makeTaskRecord('t1', '孤儿草稿', null)
    mocks.getAllTasks.mockResolvedValue([orphan])
    mocks.storeState.tasks = [orphan]
    mocks.prepareCurrentTaskDraft.mockImplementation(async (snapshot: { prompt: string }) => ({
      ok: true as const,
      draft: {
        task: makeTaskRecord(`task-${snapshot.prompt}`, snapshot.prompt),
        requestSettings: {},
      },
    }))
    mocks.executeTask.mockResolvedValue(undefined)

    writeQueue({
      id: 'bq-orphan',
      name: 'orphan',
      createdAt: Date.now(),
      status: 'running',
      entries: [makeEntry({ id: 'e1', seq: 1, status: 'generating', taskId: 't1', prompt: '孤儿草稿' })],
    })

    batchQueue.resumeBatchQueueIfAny('models')
    batchQueue.resumeBatchQueueIfAny('tasks')

    await waitUntil(() => readQueue()?.status === 'done', 'orphan rerun finish')

    expect(mocks.deleteTask).toHaveBeenCalledWith('t1')
    const queue = readQueue()
    expect(queue?.entries[0].status).toBe('done')
    expect(queue?.entries[0].taskId).not.toBe('t1')
  })

  it('上一批收尾时发新批次：新批次被补跑而不是卡在排队中', async () => {
    const deferreds = new Map<string, Deferred>()
    let prepareSeq = 0
    mocks.prepareCurrentTaskDraft.mockImplementation(async (snapshot: { prompt: string }) => {
      prepareSeq += 1
      return {
        ok: true as const,
        draft: {
          task: makeTaskRecord(`task-${prepareSeq}`, snapshot.prompt),
          requestSettings: {},
        },
      }
    })
    mocks.executeTask.mockImplementation(async (taskId: string) => {
      const deferred = trackDeferred()
      deferreds.set(taskId, deferred)
      return deferred.promise
    })

    batchQueue.startBatchQueue(['旧批次-1'], { size: '1024x1024', quality: 'medium' })
    await waitUntil(() => deferreds.size >= 1, 'old batch executing')

    // 模拟上一批仍在执行时注入新批次（页面恢复路径）
    writeQueue({
      id: 'bq-new',
      name: 'new',
      createdAt: Date.now(),
      status: 'running',
      entries: [makeEntry({ id: 'n1', seq: 1, prompt: '新批次-1' })],
    })
    batchQueue.resumeBatchQueueIfAny('models')
    batchQueue.resumeBatchQueueIfAny('tasks')

    // 放行旧批次，worker 空出来后应自动认领新批次
    for (const deferred of deferreds.values()) deferred.resolve()
    await waitUntil(() => deferreds.has('task-2'), 'new batch claimed and executing')
    for (const deferred of deferreds.values()) deferred.resolve()

    await waitUntil(() => readQueue()?.status === 'done', 'new batch finish')

    const queue = readQueue()
    expect(queue?.id).toBe('bq-new')
    expect(queue?.entries[0].status).toBe('done')
    expect(queue?.entries[0].prompt).toBe('新批次-1')
  })
})
