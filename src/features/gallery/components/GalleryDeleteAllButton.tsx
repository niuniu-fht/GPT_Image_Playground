import { useMemo, useState } from 'react'
import { isTaskInRecycleBin, useStore } from '../../../store'
import { RECYCLE_BIN_RETENTION_DAYS } from '../../../store/constants'
import { moveGalleryTasksToRecycleBin } from '../../../store/galleryMutations'
import { resolveFilteredGalleryTasks } from '../lib/taskFiltering'

function TrashIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7H5m5 4v6m4-6v6M9 7V4h6v3m-7 0h8m-9 0-.867 12.142A2 2 0 008.128 21h7.744a2 2 0 001.995-1.858L18.733 7"
      />
    </svg>
  )
}

export default function GalleryDeleteAllButton() {
  const tasks = useStore((state) => state.tasks)
  const categories = useStore((state) => state.categories)
  const providers = useStore((state) => state.providers)
  const activeCategoryFilter = useStore((state) => state.activeCategoryFilter)
  const searchQuery = useStore((state) => state.searchQuery)
  const filterStatus = useStore((state) => state.filterStatus)
  const taskView = useStore((state) => state.taskView)
  const selectedTaskIds = useStore((state) => state.selectedTaskIds)
  const setConfirmDialog = useStore((state) => state.setConfirmDialog)
  const showToast = useStore((state) => state.showToast)
  const [deleting, setDeleting] = useState(false)

  const targetTasks = useMemo(() => {
    if (taskView !== 'gallery') return []
    if (selectedTaskIds.length) {
      const selectedIdSet = new Set(selectedTaskIds)
      return tasks.filter((task) => selectedIdSet.has(task.id) && !isTaskInRecycleBin(task))
    }

    return resolveFilteredGalleryTasks({
      activeCategoryFilter,
      categories,
      filterStatus,
      providers,
      searchQuery,
      tasks,
      taskView,
    })
  }, [
    activeCategoryFilter,
    categories,
    filterStatus,
    providers,
    searchQuery,
    selectedTaskIds,
    taskView,
    tasks,
  ])

  if (taskView !== 'gallery') return null

  const hasSelection = selectedTaskIds.length > 0
  const label = deleting ? '删除中…' : hasSelection ? '删除所选图片' : '删除全部图片'

  const runDelete = async () => {
    setDeleting(true)
    try {
      await moveGalleryTasksToRecycleBin(targetTasks)
      showToast(`已移入回收站，${RECYCLE_BIN_RETENTION_DAYS} 天后自动清理，期间可恢复`, 'success')
    } catch (error) {
      showToast(`删除失败：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleClick = () => {
    if (deleting) return
    if (!targetTasks.length) {
      showToast('当前范围没有可删除的任务', 'info')
      return
    }

    setConfirmDialog({
      title: hasSelection ? '删除所选图片' : '删除全部图片',
      message: `将把 ${targetTasks.length} 个任务移入回收站，${RECYCLE_BIN_RETENTION_DAYS} 天后自动清理；期间可在回收站恢复。`,
      confirmText: '确认删除',
      action: runDelete,
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={deleting || !targetTasks.length}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-red-200/80 bg-red-50 px-2.5 text-[11px] font-semibold text-red-500 transition-all duration-200 hover:-translate-y-px hover:bg-red-100/80 disabled:cursor-not-allowed disabled:opacity-55 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
      title={hasSelection ? `删除已选 ${selectedTaskIds.length} 项（移入回收站）` : '删除当前筛选结果中的全部任务（移入回收站）'}
    >
      <TrashIcon spinning={deleting} />
      <span className="hidden sm:inline">{label}</span>
      {!deleting && targetTasks.length > 0 && (
        <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] leading-none text-red-500 dark:bg-white/[0.08] dark:text-red-300">
          {targetTasks.length}
        </span>
      )}
    </button>
  )
}
