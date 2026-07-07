import {
  isTaskInRecycleBin,
  resolveTaskCategoryName,
  resolveTaskModelLabel,
} from '../../../store'
import {
  ALL_CATEGORY_FILTER,
  FAVORITES_CATEGORY_FILTER,
  UNCATEGORIZED_CATEGORY_FILTER,
  type CategoryConfig,
  type ProviderConfig,
  type TaskRecord,
  type TaskStatus,
  type TaskView,
} from '../../../types'

export interface GalleryTaskFilterInput {
  activeCategoryFilter: string
  categories: CategoryConfig[]
  filterStatus: TaskStatus | 'all'
  providers: ProviderConfig[]
  searchQuery: string
  tasks: TaskRecord[]
  taskView: TaskView
}

export function resolveGallerySourceTasks(tasks: TaskRecord[], taskView: TaskView): TaskRecord[] {
  return tasks.filter((task) => (
    taskView === 'trash' ? isTaskInRecycleBin(task) : !isTaskInRecycleBin(task)
  ))
}

export function resolveFilteredGalleryTasks(input: GalleryTaskFilterInput): TaskRecord[] {
  const {
    activeCategoryFilter,
    categories,
    filterStatus,
    searchQuery,
    tasks,
    taskView,
  } = input
  const categoryIdSet = new Set(categories.map((category) => category.id))
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const sortedTasks = [...resolveGallerySourceTasks(tasks, taskView)].sort((taskA, taskB) => {
    const timeA = taskView === 'trash' ? taskA.deletedAt ?? taskA.createdAt : taskA.createdAt
    const timeB = taskView === 'trash' ? taskB.deletedAt ?? taskB.createdAt : taskB.createdAt
    return timeB - timeA
  })

  return sortedTasks.filter((task) => {
    const matchCategory =
      taskView !== 'gallery'
        ? true
        : activeCategoryFilter === ALL_CATEGORY_FILTER
          ? true
          : activeCategoryFilter === FAVORITES_CATEGORY_FILTER
            ? Boolean(task.isFavorite)
            : activeCategoryFilter === UNCATEGORIZED_CATEGORY_FILTER
              ? !task.categoryId || !categoryIdSet.has(task.categoryId)
              : task.categoryId === activeCategoryFilter

    if (!matchCategory) return false
    if (filterStatus !== 'all' && task.status !== filterStatus) return false
    if (!normalizedQuery) return true

    const prompt = (task.prompt || '').toLowerCase()
    const paramsString = JSON.stringify(task.params).toLowerCase()
    const modelName = resolveTaskModelLabel(task).toLowerCase()
    const categoryName = resolveTaskCategoryName(task, categories).toLowerCase()

    return (
      prompt.includes(normalizedQuery) ||
      paramsString.includes(normalizedQuery) ||
      modelName.includes(normalizedQuery) ||
      categoryName.includes(normalizedQuery)
    )
  })
}
