import type { AppState } from '../contracts'
import type { StoreSet } from './sliceTypes'
import type { AppThemeMode, AppView, ImageEditSession, SquareShareTarget } from '../../types'

type ViewerSliceState = Pick<
  AppState,
  | 'appView'
  | 'setAppView'
  | 'themeMode'
  | 'setThemeMode'
  | 'imageEditSession'
  | 'setImageEditSession'
  | 'detailTaskId'
  | 'setDetailTaskId'
  | 'lightboxImageId'
  | 'lightboxImageList'
  | 'setLightboxImageId'
  | 'showSettings'
  | 'setShowSettings'
  | 'showPromptLibrary'
  | 'setShowPromptLibrary'
  | 'shareToSquareTarget'
  | 'setShareToSquareTarget'
>

export function createViewerSlice(set: StoreSet): ViewerSliceState {
  return {
    appView: 'home' as AppView,
    themeMode: 'system' as AppThemeMode,
    setAppView(appView: AppView) {
      set((state) => ({
        appView,
        selectedTaskIds: [],
        imageEditSession: null,
        detailTaskId: null,
        shareToSquareTarget: appView === 'square' ? null : state.shareToSquareTarget,
      }))
    },
    setThemeMode(themeMode: AppThemeMode) {
      set({ themeMode })
    },
    imageEditSession: null as ImageEditSession | null,
    setImageEditSession(imageEditSession: ImageEditSession | null) { set({ imageEditSession }) },
    detailTaskId: null as string | null,
    setDetailTaskId(detailTaskId: string | null) { set({ detailTaskId }) },
    lightboxImageId: null as string | null,
    lightboxImageList: [] as string[],
    setLightboxImageId(lightboxImageId: string | null, list?: string[]) {
      set({ lightboxImageId, lightboxImageList: list ?? (lightboxImageId ? [lightboxImageId] : []) })
    },
    showSettings: false,
    setShowSettings(showSettings: boolean) {
      set((state) => ({ showSettings, showPromptLibrary: showSettings ? false : state.showPromptLibrary }))
    },
    showPromptLibrary: false,
    setShowPromptLibrary(showPromptLibrary: boolean) {
      set((state) => ({ showPromptLibrary, showSettings: showPromptLibrary ? false : state.showSettings }))
    },
    shareToSquareTarget: null as SquareShareTarget | null,
    setShareToSquareTarget(shareToSquareTarget: SquareShareTarget | null) {
      set({ shareToSquareTarget })
    },
  }
}
