import { ALL_CATEGORY_FILTER } from "../../types"
import { normalizeCategoryList, resolveActiveCategoryFilter } from "../domain"
import type { AppState } from "../contracts"
import type { StoreSet } from "./sliceTypes"
import type { CategoryConfig, GalleryDisplayMode, TaskRecord, TaskView } from "../../types"

type TaskSliceState = Pick<
  AppState,
  | 'tasks'
  | 'setTasks'
  | 'selectedTaskIds'
  | 'setSelectedTaskIds'
  | 'toggleTaskSelection'
  | 'clearSelectedTasks'
  | 'categories'
  | 'activeCategoryFilter'
  | 'setActiveCategoryFilter'
  | 'replaceCategoryState'
  | 'searchQuery'
  | 'setSearchQuery'
  | 'filterStatus'
  | 'setFilterStatus'
  | 'taskView'
  | 'setTaskView'
  | 'galleryDisplayMode'
  | 'setGalleryDisplayMode'
>

export function createTaskSlice(set: StoreSet): TaskSliceState {
  return {
    tasks: [] as TaskRecord[],
    setTasks(tasks: TaskRecord[]) {
      set((state) => {
        const taskIds = new Set(tasks.map((task) => task.id))
        return {
          tasks,
          selectedTaskIds: state.selectedTaskIds.filter((id: string) => taskIds.has(id)),
          imageEditSession: state.imageEditSession && taskIds.has(state.imageEditSession.taskId) ? state.imageEditSession : null,
          detailTaskId: state.detailTaskId && taskIds.has(state.detailTaskId) ? state.detailTaskId : null,
        }
      })
    },
    selectedTaskIds: [] as string[],
    setSelectedTaskIds(ids: string[]) {
      set((state) => {
        const taskIds = new Set(state.tasks.map((task) => task.id))
        return { selectedTaskIds: Array.from(new Set(ids)).filter((id: string) => taskIds.has(id)) }
      })
    },
    toggleTaskSelection(id: string) {
      set((state) => {
        if (!state.tasks.some((task) => task.id === id)) return state
        const selectedTaskIds = state.selectedTaskIds.includes(id)
          ? state.selectedTaskIds.filter((taskId: string) => taskId !== id)
          : [...state.selectedTaskIds, id]
        return { selectedTaskIds }
      })
    },
    clearSelectedTasks() { set({ selectedTaskIds: [] }) },

    categories: [] as CategoryConfig[],
    activeCategoryFilter: ALL_CATEGORY_FILTER,
    setActiveCategoryFilter(activeCategoryFilter: string) {
      set((state) => ({ activeCategoryFilter: resolveActiveCategoryFilter(activeCategoryFilter, state.categories) }))
    },
    replaceCategoryState(categories: CategoryConfig[], activeCategoryFilter?: string) {
      set(() => {
        const normalizedCategories = normalizeCategoryList(categories)
        return { categories: normalizedCategories, activeCategoryFilter: resolveActiveCategoryFilter(activeCategoryFilter, normalizedCategories) }
      })
    },
    searchQuery: "",
    setSearchQuery(searchQuery: string) { set({ searchQuery }) },
    filterStatus: "all",
    setFilterStatus(filterStatus: AppState['filterStatus']) { set({ filterStatus }) },
    taskView: "gallery" as TaskView,
    setTaskView(taskView: TaskView) { set({ taskView, selectedTaskIds: [], imageEditSession: null, detailTaskId: null }) },
    galleryDisplayMode: "standard" as GalleryDisplayMode,
    setGalleryDisplayMode(galleryDisplayMode: GalleryDisplayMode) { set({ galleryDisplayMode }) },
  }
}
