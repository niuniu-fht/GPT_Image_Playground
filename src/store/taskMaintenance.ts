import { getAllTasks, putTask } from '../lib/db'
import { PlatformApiError, platformApi } from '../lib/platformApi'
import type { TaskRecord } from '../types'
import {
  ERROR_LOG_POLL_INTERVAL_MS,
  ERROR_LOG_RETENTION_MS,
  RECYCLE_BIN_POLL_INTERVAL_MS,
  RECYCLE_BIN_RETENTION_MS,
} from './constants'
import {
  listImages,
  removeImage,
  startLegacyImageAssetMigrationSweep,
} from './imageAssets'
import {
  seedGeneratedImagePersistenceRetriesFromTasks,
  startGeneratedImagePersistenceRetryWorker,
} from './generatedImagePersistenceRetry'
import { applyTaskPurgePlan } from './taskPurgeApply'
import { planOrphanImageCleanup, planTaskPurge } from './taskPurgePlanner'
import { useStore } from './state'
import { isTaskInRecycleBin } from './taskRecords'
import { repairCategoryStateFromTasks } from './taskStoreUtils'

let recycleBinJanitorId: number | null = null
let errorLogJanitorId: number | null = null
let storeInitializationPromise: Promise<void> | null = null
let authRefreshPromise: Promise<void> | null = null
let authRecoveryListenerStarted = false
let authRefreshRetryTimerId: number | null = null
let authRefreshRetryCount = 0

const AUTH_REFRESH_RETRY_BASE_DELAY_MS = 2000
const AUTH_REFRESH_RETRY_MAX_DELAY_MS = 30_000

function resolveErrorDebugCreatedAt(
  task: Pick<TaskRecord, 'createdAt' | 'finishedAt' | 'errorDebug'>,
): number {
  if (typeof task.errorDebug?.createdAt === 'number' && Number.isFinite(task.errorDebug.createdAt)) {
    return task.errorDebug.createdAt
  }
  if (typeof task.finishedAt === 'number' && Number.isFinite(task.finishedAt)) {
    return task.finishedAt
  }
  return task.createdAt
}

async function cleanupExpiredErrorDebugLogs(tasks: TaskRecord[]): Promise<TaskRecord[]> {
  const cutoff = Date.now() - ERROR_LOG_RETENTION_MS
  const expiredTaskIds = new Set(
    tasks
      .filter((task) => task.errorDebug && resolveErrorDebugCreatedAt(task) < cutoff)
      .map((task) => task.id),
  )

  if (!expiredTaskIds.size) {
    return tasks
  }

  const updatedTasks = tasks.map((task) =>
    expiredTaskIds.has(task.id)
      ? {
          ...task,
          errorDebug: null,
        }
      : task,
  )

  await Promise.all(
    updatedTasks
      .filter((task) => expiredTaskIds.has(task.id))
      .map((task) => putTask(task)),
  )

  return updatedTasks
}

function ensureErrorLogJanitorStarted() {
  if (errorLogJanitorId != null) {
    return
  }

  errorLogJanitorId = window.setInterval(() => {
    void (async () => {
      const { tasks, setTasks } = useStore.getState()
      const updatedTasks = await cleanupExpiredErrorDebugLogs(tasks)
      if (updatedTasks !== tasks) {
        setTasks(updatedTasks)
      }
    })()
  }, ERROR_LOG_POLL_INTERVAL_MS)
}

async function cleanupOrphanImages(tasks: TaskRecord[]) {
  const { inputImages } = useStore.getState()
  const images = await listImages()
  const cleanupPlan = planOrphanImageCleanup({
    allTasks: tasks,
    allImageIds: images.map((image) => image.id),
    inputImageIds: inputImages.map((image) => image.id),
  })

  for (const imageId of cleanupPlan.imageIdsToDelete) {
    await removeImage(imageId)
  }
}

function clearAuthRefreshRetry() {
  if (authRefreshRetryTimerId != null) {
    window.clearTimeout(authRefreshRetryTimerId)
    authRefreshRetryTimerId = null
  }
  authRefreshRetryCount = 0
}

function isTransientAuthRefreshError(error: unknown): boolean {
  return (
    error instanceof PlatformApiError &&
    (
      error.status === 0 ||
      error.status === 408 ||
      error.status === 425 ||
      error.status === 429 ||
      error.status >= 500
    )
  )
}

function scheduleAuthRefreshRetry() {
  if (authRefreshRetryTimerId != null) {
    return
  }

  authRefreshRetryCount += 1
  const delay = Math.min(
    AUTH_REFRESH_RETRY_BASE_DELAY_MS * (2 ** Math.max(0, authRefreshRetryCount - 1)),
    AUTH_REFRESH_RETRY_MAX_DELAY_MS,
  )
  authRefreshRetryTimerId = window.setTimeout(() => {
    authRefreshRetryTimerId = null
    void refreshAuthSession()
  }, delay)
}

function refreshAuthSession(): Promise<void> {
  if (authRefreshPromise) {
    return authRefreshPromise
  }

  authRefreshPromise = platformApi
    .getMe()
    .then(({ user }) => {
      clearAuthRefreshRetry()
      useStore.getState().setCurrentUser(user)
    })
    .catch((error: unknown) => {
      if (error instanceof PlatformApiError && error.status === 401) {
        clearAuthRefreshRetry()
        useStore.getState().setCurrentUser(null)
        return
      }
      if (isTransientAuthRefreshError(error)) {
        scheduleAuthRefreshRetry()
      }
    })
    .finally(() => {
      useStore.getState().setAuthReady(true)
      authRefreshPromise = null
    })

  return authRefreshPromise
}

function ensureAuthRecoveryListenerStarted() {
  if (authRecoveryListenerStarted) {
    return
  }

  authRecoveryListenerStarted = true
  window.addEventListener('online', () => {
    clearAuthRefreshRetry()
    void refreshAuthSession()
  })
}

async function initializeStore() {
  ensureAuthRecoveryListenerStarted()
  void refreshAuthSession()

  void platformApi
    .listModels()
    .then(({ models }) => useStore.getState().setModels(models))
    .catch(() => {
      useStore.getState().setModels([])
      useStore.getState().showToast('模型列表加载失败，请确认后端服务已启动', 'error')
    })

  void platformApi
    .listPublicAnnouncements()
    .then(({ items }) => useStore.getState().setAnnouncements(items))
    .catch(() => undefined)

  const tasks = await cleanupExpiredErrorDebugLogs(await getAllTasks())
  useStore.getState().setTasks(tasks)
  repairCategoryStateFromTasks(tasks)
  ensureErrorLogJanitorStarted()
  startGeneratedImagePersistenceRetryWorker()

  window.setTimeout(() => {
    void cleanupOrphanImages(tasks).finally(() => {
      startLegacyImageAssetMigrationSweep()
    })
  }, 1000)

  window.setTimeout(() => {
    void seedGeneratedImagePersistenceRetriesFromTasks(tasks)
  }, 300)
}

export function initStore(): Promise<void> {
  if (!storeInitializationPromise) {
    storeInitializationPromise = initializeStore().catch((error: unknown) => {
      storeInitializationPromise = null
      throw error
    })
  }

  return storeInitializationPromise
}

export async function cleanupExpiredRecycleBinTasks() {
  const tasks = await getAllTasks()
  const cutoff = Date.now() - RECYCLE_BIN_RETENTION_MS
  const expiredTasks = tasks.filter(
    (task) => isTaskInRecycleBin(task) && (task.deletedAt ?? 0) <= cutoff,
  )

  if (!expiredTasks.length) {
    return 0
  }

  const { inputImages } = useStore.getState()
  const purgePlan = planTaskPurge({
    allTasks: tasks,
    taskIdsToDelete: expiredTasks.map((task) => task.id),
    inputImageIds: inputImages.map((image) => image.id),
  })

  if (!purgePlan.taskIdsToDelete.length) {
    return 0
  }

  await applyTaskPurgePlan(purgePlan)
  return purgePlan.taskIdsToDelete.length
}

export function startRecycleBinJanitor() {
  if (recycleBinJanitorId != null) {
    return () => {
      if (recycleBinJanitorId != null) {
        window.clearInterval(recycleBinJanitorId)
        recycleBinJanitorId = null
      }
    }
  }

  void cleanupExpiredRecycleBinTasks()
  recycleBinJanitorId = window.setInterval(() => {
    void cleanupExpiredRecycleBinTasks()
  }, RECYCLE_BIN_POLL_INTERVAL_MS)

  return () => {
    if (recycleBinJanitorId != null) {
      window.clearInterval(recycleBinJanitorId)
      recycleBinJanitorId = null
    }
  }
}
