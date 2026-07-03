import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppState } from './contracts'
import { createProviderSlice } from './slices/providerSlice'
import { createInputDraftSlice } from './slices/inputDraftSlice'
import { createTaskSlice } from './slices/taskSlice'
import { createViewerSlice } from './slices/viewerSlice'
import { createDialogSlice } from './slices/dialogSlice'
import { createAccountSlice } from './slices/accountSlice'
import { buildPersistedAppStateSnapshot, mergePersistedAppState } from './persistedState'

export const useStore = create<AppState>()(
  persist(
    (...args) => ({
      ...createProviderSlice(args[0]),
      ...createInputDraftSlice(args[0]),
      ...createTaskSlice(args[0]),
      ...createViewerSlice(args[0]),
      ...createDialogSlice(args[0]),
      ...createAccountSlice(args[0]),
    }),
    {
      name: 'gpt-image-playground',
      partialize: (state) => buildPersistedAppStateSnapshot(state),
      merge: (persistedState, currentState) =>
        mergePersistedAppState(persistedState as Partial<AppState> | undefined, currentState),
    },
  ),
)
