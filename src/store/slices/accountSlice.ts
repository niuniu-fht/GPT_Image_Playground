import type { AdminAnnouncement, CurrentUser, ModelConfig } from '../../types'

export function createAccountSlice(set: any) {
  return {
    currentUser: null as CurrentUser | null,
    authReady: false,
    authModalOpen: false,
    authMode: 'login' as 'login' | 'register',
    models: [] as ModelConfig[],
    announcements: [] as AdminAnnouncement[],
    activeModelId: null as string | null,
    showAdminModels: false,

    setCurrentUser(user: CurrentUser | null) {
      set({ currentUser: user })
    },

    setAuthReady(authReady: boolean) {
      set({ authReady })
    },

    openAuthModal(mode: 'login' | 'register' = 'login') {
      set({ authModalOpen: true, authMode: mode })
    },

    closeAuthModal() {
      set({ authModalOpen: false })
    },

    setModels(models: ModelConfig[]) {
      set((state: any) => {
        const activeStillExists = models.some((model) => model.id === state.activeModelId)
        return {
          models,
          activeModelId: activeStillExists ? state.activeModelId : models[0]?.id ?? null,
        }
      })
    },

    setAnnouncements(announcements: AdminAnnouncement[]) {
      set({ announcements })
    },

    setActiveModelId(activeModelId: string) {
      set({ activeModelId })
    },

    setShowAdminModels(showAdminModels: boolean) {
      set({ showAdminModels })
    },
  }
}
