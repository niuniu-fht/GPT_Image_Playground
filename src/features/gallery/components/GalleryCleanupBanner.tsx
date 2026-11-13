import { useMemo, useState } from 'react'
import { isTaskInRecycleBin, useStore } from '../../../store'
import { GALLERY_CLEANUP_BATCH_SIZE, GALLERY_SUGGESTED_MAX_TASKS } from '../../../store/constants'
import { moveGalleryTasksToRecycleBin } from '../../../store/galleryMutations'
import { RECYCLE_BIN_RETENTION_DAYS } from '../../../store/constants'

const DISMISS_STORAGE_KEY = 'gallery-cleanup-banner-dismissed-count'
const REGROWTH_REMINDER_STEP = 10

function isTaskAutoCleanupCandidate(task: { isFavorite?: boolean | null; deletedAt?: number | null; outputImages: string[] }) {
  return !task.isFavorite && !isTaskInRecycleBin(task) && task.outputImages.length > 0
}

export default function GalleryCleanupBanner() {
  const tasks = useStore((state) => state.tasks)
  const setConfirmDialog = useStore((state) => state.setConfirmDialog)
  const showToast = useStore((state) => state.showToast)
  const [dismissedCount, setDismissedCount] = useState<number | null>(() => {
    const stored = Number(window.localStorage.getItem(DISMISS_STORAGE_KEY))
    return Number.isFinite(stored) && stored > 0 ? stored : null
  })
  const [cleaning, setCleaning] = useState(false)

  const galleryCount = useMemo(
    () => tasks.filter((task) => !isTaskInRecycleBin(task)).length,
    [tasks],
  )

  const overLimitCount = galleryCount - GALLERY_SUGGESTED_MAX_TASKS
  const shouldShow = galleryCount > GALLERY_SUGGESTED_MAX_TASKS && (dismissedCount === null || galleryCount > dismissedCount + REGROWTH_REMINDER_STEP)

  const cleanupCandidates = useMemo(() => {
    if (!shouldShow || overLimitCount <= 0) return []
    return tasks
      .filter(isTaskAutoCleanupCandidate)
      .sort((left, right) => left.createdAt - right.createdAt)
      .slice(0, GALLERY_CLEANUP_BATCH_SIZE)
  }, [overLimitCount, shouldShow, tasks])

  if (!shouldShow) return null

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(galleryCount))
    setDismissedCount(galleryCount)
  }

  const runCleanup = async () => {
    setCleaning(true)
    try {
      await moveGalleryTasksToRecycleBin(cleanupCandidates)
      showToast(`已把最旧的 ${cleanupCandidates.length} 条记录移入回收站（${RECYCLE_BIN_RETENTION_DAYS} 天后自动清理）`, 'success')
      window.localStorage.setItem(DISMISS_STORAGE_KEY, String(useStore.getState().tasks.filter((task) => !isTaskInRecycleBin(task)).length))
      setDismissedCount(useStore.getState().tasks.filter((task) => !isTaskInRecycleBin(task)).length)
    } catch (error) {
      showToast(`清理失败：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setCleaning(false)
    }
  }

  const handleCleanupClick = () => {
    if (cleaning || !cleanupCandidates.length) {
      showToast('当前可自动清理的记录不足（收藏的记录不会被清理）', 'info')
      return
    }
    setConfirmDialog({
      title: '清理最旧的画廊记录',
      message: `将把最旧的 ${cleanupCandidates.length} 条记录移入回收站（${RECYCLE_BIN_RETENTION_DAYS} 天后自动清理，期间可在回收站恢复）。收藏的记录不会被清理。`,
      confirmText: '开始清理',
      action: async () => {
        void runCleanup()
      },
    })
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 dark:border-amber-400/20 dark:bg-amber-400/[0.08]">
      <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
      <span className="min-w-0 flex-1 text-sm leading-6 text-amber-800 dark:text-amber-200">
        画廊已存 <strong className="tabular-nums">{galleryCount}</strong> 张图片，建议清理一部分旧图以保证加载速度。
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={cleaning}
          onClick={handleCleanupClick}
          className="inline-flex h-8 items-center rounded-full bg-amber-500 px-3 text-xs font-semibold text-amber-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cleaning ? '清理中…' : `清理最旧的 ${cleanupCandidates.length || overLimitCount} 条`}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex h-8 items-center rounded-full px-2 text-xs text-amber-600 transition hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-400/10"
        >
          暂不处理
        </button>
      </div>
    </div>
  )
}
