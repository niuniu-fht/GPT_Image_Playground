import type { AppState } from '../contracts'
import type { StoreSet } from './sliceTypes'

type DialogSliceState = Pick<AppState, 'toast' | 'showToast' | 'confirmDialog' | 'setConfirmDialog'>

export function createDialogSlice(set: StoreSet): DialogSliceState {
  return {
    toast: null,
    showToast(message: string, type: "info" | "success" | "error" = "info") {
      set({ toast: { message, type } })
      setTimeout(() => {
        set((state) => (state.toast?.message === message ? { toast: null } : state))
      }, 3000)
    },
    confirmDialog: null,
    setConfirmDialog(confirmDialog: AppState['confirmDialog']) { set({ confirmDialog }) },
  }
}
