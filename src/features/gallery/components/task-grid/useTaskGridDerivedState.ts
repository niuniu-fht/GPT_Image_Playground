import { useMemo } from 'react'
import {
  UNCATEGORIZED_CATEGORY_FILTER,
  type CategoryConfig,
  type ProviderConfig,
  type TaskRecord,
  type TaskStatus,
  resolveCategoryFilterName,
} from '../../../../types'
import { resolveFilteredGalleryTasks, resolveGallerySourceTasks } from '../../lib/taskFiltering'
import type { CategoryOption } from './shared'

interface UseTaskGridDerivedStateOptions {
  tasks: TaskRecord[]
  categories: CategoryConfig[]
  providers: ProviderConfig[]
  activeCategoryFilter: string
  searchQuery: string
  filterStatus: TaskStatus | 'all'
  taskView: 'gallery' | 'trash'
  selectedTaskIds: string[]
}

export function useTaskGridDerivedState(options: UseTaskGridDerivedStateOptions) {
  const {
    tasks,
    categories,
    providers,
    activeCategoryFilter,
    searchQuery,
    filterStatus,
    taskView,
    selectedTaskIds,
  } = options

  const categoryIdSet = useMemo(
    () => new Set(categories.map((category) => category.id)),
    [categories],
  )
  const sourceTasks = useMemo(
    () => resolveGallerySourceTasks(tasks, taskView),
    [taskView, tasks],
  )

  const filteredTasks = useMemo(
    () => resolveFilteredGalleryTasks({
      activeCategoryFilter,
      categories,
      filterStatus,
      providers,
      searchQuery,
      tasks,
      taskView,
    }),
    [
      activeCategoryFilter,
      categories,
      filterStatus,
      providers,
      searchQuery,
      tasks,
      taskView,
    ],
  )

  const selectedIdSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds])
  const visibleTaskIds = useMemo(() => filteredTasks.map((task) => task.id), [filteredTasks])
  const visibleTaskIdSet = useMemo(() => new Set(visibleTaskIds), [visibleTaskIds])
  const selectedTasks = useMemo(
    () => sourceTasks.filter((task) => selectedIdSet.has(task.id)),
    [sourceTasks, selectedIdSet],
  )
  const visibleSelectedCount = useMemo(
    () => visibleTaskIds.filter((taskId) => selectedIdSet.has(taskId)).length,
    [visibleTaskIds, selectedIdSet],
  )
  const selectedCount = selectedIdSet.size
  const allSelectedFavorited =
    selectedTasks.length > 0 && selectedTasks.every((task) => Boolean(task.isFavorite))
  const hasVisibleTasks = visibleTaskIds.length > 0
  const allVisibleSelected = hasVisibleTasks && visibleSelectedCount === visibleTaskIds.length
  const categoryOptions = useMemo<CategoryOption[]>(
    () => [
      { label: '未分类', value: UNCATEGORIZED_CATEGORY_FILTER },
      ...categories.map((category) => ({
        label: category.name,
        value: category.id,
      })),
    ],
    [categories],
  )
  const activeCategoryLabel = resolveCategoryFilterName(activeCategoryFilter, categories)

  return {
    categoryIdSet,
    sourceTasks,
    filteredTasks,
    selectedIdSet,
    visibleTaskIds,
    visibleTaskIdSet,
    selectedTasks,
    visibleSelectedCount,
    selectedCount,
    allSelectedFavorited,
    hasVisibleTasks,
    allVisibleSelected,
    categoryOptions,
    activeCategoryLabel,
  }
}
