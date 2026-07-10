import { useMemo, useState } from 'react'
import { isTaskInRecycleBin, useStore } from '../../../store'
import { countTaskOutputImages, exportGalleryImagesZip } from '../lib/exportGalleryImages'
import { resolveFilteredGalleryTasks } from '../lib/taskFiltering'

function ExportIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {spinning ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 3a9 9 0 1 1-8.49 6"
        />
      ) : (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v11m0 0 4-4m-4 4-4-4"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 17.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5"
          />
        </>
      )}
    </svg>
  )
}

export default function GalleryExportButton() {
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
  const [exporting, setExporting] = useState(false)

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

  const imageCount = countTaskOutputImages(targetTasks)
  const hasSelection = selectedTaskIds.length > 0
  const label = exporting
    ? '打包中…'
    : hasSelection
      ? '导出所选图片'
      : '导出全部图片'

  const runExport = async () => {
    setExporting(true)
    try {
      const result = await exportGalleryImagesZip(targetTasks)
      if (!result.exportedImageCount && !result.failedImageCount) {
        showToast('当前范围没有可导出的图片', 'info')
        return
      }
      if (!result.exportedImageCount && result.failedImageCount > 0) {
        showToast(`没有图片成功导出，${result.failedImageCount} 张因跨域或读取失败未导出`, 'error')
        return
      }
      if (result.failedImageCount > 0) {
        showToast(
          `已导出 ${result.exportedImageCount} 张，${result.failedImageCount} 张因跨域或读取失败未导出`,
          'error',
        )
        return
      }
      showToast(`已导出 ${result.exportedImageCount} 张图片`, 'success')
    } catch (error) {
      showToast(`导出失败：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleClick = () => {
    if (exporting) return
    if (!targetTasks.length || imageCount === 0) {
      showToast('当前范围没有可导出的图片', 'info')
      return
    }

    setConfirmDialog({
      title: hasSelection ? '导出所选图片' : '导出全部图片',
      message: `将导出 ${targetTasks.length} 个任务中的 ${imageCount} 张图片。`,
      confirmText: '开始导出',
      action: runExport,
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={exporting}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50 px-2.5 text-[11px] font-semibold text-blue-600 transition-all duration-200 hover:-translate-y-px hover:bg-blue-100/80 disabled:cursor-not-allowed disabled:opacity-55 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
      title={hasSelection ? `导出已选 ${selectedTaskIds.length} 项图片` : '导出当前筛选结果中的全部图片'}
    >
      <ExportIcon spinning={exporting} />
      <span className="hidden sm:inline">{label}</span>
      {!exporting && imageCount > 0 && (
        <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] leading-none text-blue-600 dark:bg-white/[0.08] dark:text-blue-200">
          {imageCount}
        </span>
      )}
    </button>
  )
}
