import { prepareCurrentTaskDraft } from './taskDraft'
import { enqueueTaskRun } from './taskRun'
import { executeTask } from './taskExecutor'
import { deleteTask, getAllTasks, putTask } from '../lib/db'
import { findProviderById, getProviderSettings } from './domain'
import { useStore } from './state'
import type { TaskParams, TaskRecord } from '../types'

const STORAGE_KEY = 'batch-generation-queue-v1'
const CONCURRENCY = 9
const MAX_ITEMS = 50

export const BATCH_MAX_ITEMS = MAX_ITEMS
export const BATCH_CONCURRENCY = CONCURRENCY

export type BatchEntryStatus = 'queued' | 'generating' | 'done' | 'failed' | 'cancelled'

export interface BatchQueueEntry {
  id: string
  seq: number
  prompt: string
  size: string
  quality: string
  status: BatchEntryStatus
  taskId?: string | null
  /** 页面刷新前已提交到上游的任务：恢复时直接等待该任务结果，不重新生成、不重复扣费 */
  resumeTaskId?: string | null
  error?: string | null
}

export interface BatchQueueState {
  id: string
  name: string
  createdAt: number
  status: 'running' | 'done' | 'partial_failed' | 'cancelled'
  entries: BatchQueueEntry[]
}

const listeners = new Set<() => void>()
let runnerRunning = false
let runnerKickPending = false

function load(): BatchQueueState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as BatchQueueState) : null
  } catch {
    return null
  }
}

function save(queue: BatchQueueState | null) {
  try {
    if (!queue) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // 存储不可用时静默：批次仍在本会话内存中运行
  }
  for (const listener of listeners) listener()
}

export function subscribeBatchQueue(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getBatchQueueSnapshot(): BatchQueueState | null {
  return load()
}

export function hasActiveBatchQueue(): boolean {
  const queue = load()
  return Boolean(
    queue &&
      queue.status === 'running' &&
      queue.entries.some((entry) => entry.status === 'queued' || entry.status === 'generating'),
  )
}

export function hasBatchQueueRecords(): boolean {
  return Boolean(load())
}

export function clearBatchQueue() {
  save(null)
}

export function cancelBatchQueue(): BatchQueueState | null {
  const queue = load()
  if (!queue) return null
  for (const entry of queue.entries) {
    if (entry.status === 'queued') entry.status = 'cancelled'
  }
  if (queue.entries.every((entry) => entry.status !== 'generating')) {
    queue.status = queue.entries.some((entry) => entry.status === 'done') ? 'partial_failed' : 'cancelled'
  }
  save(queue)
  return queue
}

/** 创建批次队列并启动执行（每行 1 张，走与单图完全相同的前端生成管线）。 */
export function startBatchQueue(
  prompts: string[],
  params: { size: string; quality: string },
): string | null {
  if (hasActiveBatchQueue()) return null
  const base = Date.now()
  const queue: BatchQueueState = {
    id: `bq-${base}`,
    name: `批量批次 ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    createdAt: Date.now(),
    status: 'running',
    entries: prompts.slice(0, MAX_ITEMS).map((prompt, index) => ({
      id: `${base}-${index + 1}`,
      seq: index + 1,
      prompt,
      size: params.size,
      quality: params.quality,
      status: 'queued',
      taskId: null,
      resumeTaskId: null,
      error: null,
    })),
  }
  save(queue)
  void runQueue()
  return queue.id
}

let modelsReady = false
let tasksReady = false

/**
 * 批量恢复依赖模型列表与本地任务记录两份数据。
 * 模型用于校验草稿、任务记录用于识别刷新前已提交的条目；两者都就绪后才恢复执行。
 * taskMaintenance 会在两份数据分别就绪时各调用一次。
 */
export function resumeBatchQueueIfAny(source: 'models' | 'tasks'): void {
  if (source === 'models') modelsReady = true
  if (source === 'tasks') tasksReady = true
  if (!modelsReady || !tasksReady) return

  const queue = load()
  if (!queue || queue.status !== 'running') return
  if (!queue.entries.some((entry) => entry.status === 'queued' || entry.status === 'generating')) return
  void runQueue()
}

/** 恢复前归一化条目状态：刷新后没有任何真正在跑的生成，"生成中"条目要么等已提交任务、要么重新排队。 */
async function normalizeResumableEntries(): Promise<void> {
  const queue = load()
  if (!queue || queue.status !== 'running') return

  const allTasks = await getAllTasks()
  const taskById = new Map(allTasks.map((task) => [task.id, task]))
  let changed = false

  for (const entry of queue.entries) {
    if (entry.status !== 'generating') continue
    const task = entry.taskId ? taskById.get(entry.taskId) : undefined
    if (task && task.generationTaskId) {
      // 已提交上游：重新排队并标记走恢复路径，worker 认领后直接等待原任务，不重复扣费
      entry.resumeTaskId = task.id
      entry.status = 'queued'
    } else {
      // 未提交上游的孤儿草稿：删掉记录后重新排队
      if (task) {
        void deleteTask(task.id).catch((error: unknown) => {
          console.error('[batch-queue] failed to delete unsubmitted orphan draft', task.id, error)
        })
      }
      entry.status = 'queued'
      entry.taskId = null
    }
    changed = true
  }

  if (changed) save(queue)
}

async function refreshStoreTasks() {
  const tasks = await getAllTasks()
  useStore.getState().setTasks(tasks)
}

/**
 * 一次性清理旧版（服务端驱动）批量方案遗留的占位任务：
 * 卡在「生成中」的占位记录已无对应可恢复的结果，标记为失败并退款提示。
 */
export async function cleanupLegacyBatchPlaceholders(): Promise<number> {
  const tasks = await getAllTasks()
  const stale = tasks.filter(
    (task) => task.id.startsWith('srv-item-') && task.status === 'running' && !task.generationTaskId,
  )
  for (const task of stale) {
    await putTask({ ...task, status: 'error', error: '批量批次已中止，积分已退还' })
  }
  if (stale.length > 0) {
    await refreshStoreTasks()
  }
  return stale.length
}

function reasonText(reason: string): string {
  if (reason === 'missing_login') return '请先登录后再生成'
  if (reason === 'missing_model') return '暂无可用模型'
  if (reason === 'insufficient_credits') return '积分不足，无法生成'
  if (reason === 'missing_prompt_or_inputs') return '提示词为空'
  if (reason === 'too_many_masked_inputs') return '蒙版参考图过多'
  return '生成失败，请稍后重试'
}

/**
 * 读取最新队列 → 同步修改 → 写回。
 * 禁止跨 await 持有队列快照再写回，否则会覆盖其他 worker 的并发更新（丢 taskId、状态回退）。
 * load → mutator → save 全程同步，事件循环保证多 worker 认领互斥。
 */
function mutateQueue(
  queueId: string,
  mutator: (queue: BatchQueueState) => void,
): BatchQueueState | null {
  const queue = load()
  if (!queue || queue.id !== queueId || queue.status !== 'running') return null
  mutator(queue)
  save(queue)
  return queue
}

function resolveTaskRequestSettings(task: TaskRecord) {
  const snapshot = useStore.getState()
  const provider = findProviderById(snapshot.providers, task.providerId)
  return provider ? getProviderSettings(provider) : snapshot.settings
}

/** 根据任务记录的最终状态回写条目；状态已不是 running（如已取消）时跳过。 */
function markEntryFromTask(queueId: string, entryId: string, taskId: string) {
  const task = useStore.getState().tasks.find((item) => item.id === taskId)
  mutateQueue(queueId, (queue) => {
    const entry = queue.entries.find((item) => item.id === entryId)
    if (!entry) return
    if (task && task.status === 'error') {
      entry.status = 'failed'
      entry.error = task.error || '生成失败，请稍后重试'
    } else {
      entry.status = 'done'
      entry.error = null
    }
  })
}

async function runClaimedEntry(queueId: string, claimId: string, entry: BatchQueueEntry): Promise<void> {
  try {
    if (entry.resumeTaskId) {
      // 刷新恢复路径：任务已在刷新前提交上游，直接等待原任务（executeTask 按 taskId 去重，
      // 与全局任务恢复 resumeRunningTasks 并发时共享同一次执行，不会重复提交）。
      const task = useStore.getState().tasks.find((item) => item.id === entry.resumeTaskId)
      if (!task) {
        mutateQueue(queueId, (queue) => {
          const target = queue.entries.find((item) => item.id === claimId)
          if (target) {
            target.status = 'failed'
            target.error = '任务记录缺失，请重新生成'
          }
        })
        return
      }
      await executeTask(task.id, resolveTaskRequestSettings(task))
      markEntryFromTask(queueId, claimId, task.id)
      return
    }

    const snapshot = useStore.getState()
    const prepared = await prepareCurrentTaskDraft({
      settings: snapshot.settings,
      providers: snapshot.providers,
      categories: snapshot.categories,
      activeProviderId: snapshot.activeProviderId,
      activeCategoryFilter: snapshot.activeCategoryFilter,
      prompt: entry.prompt,
      inputImages: [],
      params: {
        ...snapshot.params,
        size: entry.size,
        quality: entry.quality as TaskParams['quality'],
        n: 1,
      },
      currentUser: snapshot.currentUser,
      activeModelId: snapshot.activeModelId,
      models: snapshot.models,
    })
    if (!prepared.ok) {
      mutateQueue(queueId, (queue) => {
        const target = queue.entries.find((item) => item.id === claimId)
        if (target) {
          target.status = 'failed'
          target.error = reasonText(prepared.reason)
        }
      })
      return
    }

    const taskId = prepared.draft.task.id
    mutateQueue(queueId, (queue) => {
      const target = queue.entries.find((item) => item.id === claimId)
      if (target) target.taskId = taskId
    })

    // 走与单图完全相同的执行管线：落库 → 提交 → 轮询 → 图片落库 → 更新任务记录
    await enqueueTaskRun(prepared.draft.task)
    await executeTask(taskId, prepared.draft.requestSettings)
    markEntryFromTask(queueId, claimId, taskId)
  } catch (error) {
    mutateQueue(queueId, (queue) => {
      const target = queue.entries.find((item) => item.id === claimId)
      if (target) {
        target.status = 'failed'
        target.error = error instanceof Error ? error.message.slice(0, 160) : '生成失败，请稍后重试'
      }
    })
  }
}

async function worker(): Promise<void> {
  for (;;) {
    const queue = load()
    if (!queue || queue.status !== 'running') return

    // 同步认领一条任务；认领失败说明没有待处理条目，worker 退出
    let claimedId: string | null = null
    let claimedEntry: BatchQueueEntry | null = null
    mutateQueue(queue.id, (current) => {
      const entry = current.entries.find((item) => item.status === 'queued')
      if (!entry) return
      entry.status = 'generating'
      entry.error = null
      claimedId = entry.id
      claimedEntry = { ...entry }
    })
    if (!claimedId || !claimedEntry) return

    await runClaimedEntry(queue.id, claimedId, claimedEntry)
  }
}

/** 所有 worker 退出后收尾：把残留「生成中」标记为失败（正常流程不会出现），并落最终批次状态。 */
function finalizeQueue(): void {
  const queue = load()
  if (!queue || queue.status !== 'running') return
  if (queue.entries.some((entry) => entry.status === 'queued')) return

  for (const entry of queue.entries) {
    if (entry.status === 'generating') {
      entry.status = 'failed'
      entry.error = entry.error || '生成中断，请重试'
    }
  }
  const hasBad = queue.entries.some((entry) => entry.status === 'failed' || entry.status === 'cancelled')
  queue.status = hasBad ? 'partial_failed' : 'done'
  save(queue)
}

async function runQueue(): Promise<void> {
  if (runnerRunning) {
    // 已有 worker 池在跑：标记需要补一轮，池退出后自动服务新队列，避免直接 return 造成新批次无人认领
    runnerKickPending = true
    return
  }
  runnerRunning = true
  try {
    do {
      runnerKickPending = false
      await normalizeResumableEntries()
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
      finalizeQueue()
    } while (runnerKickPending)
  } finally {
    runnerRunning = false
  }
}
