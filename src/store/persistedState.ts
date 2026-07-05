import type { AppThemeMode, AppView, GalleryDisplayMode } from '../types'
import type { AppState, PersistedAppStateSnapshot } from './contracts'
import {
  createInitialProviderState,
  getProviderSettings,
  normalizeCategoryList,
  normalizePromptLibraryItems,
  normalizeProviderList,
  resolveActiveCategoryFilter,
} from './domain'

export function buildPersistedAppStateSnapshot(state: AppState): PersistedAppStateSnapshot {
  return {
    settings: state.settings,
    providers: state.providers,
    activeProviderId: state.activeProviderId,
    categories: state.categories,
    activeCategoryFilter: state.activeCategoryFilter,
    params: state.params,
    promptLibrary: state.promptLibrary,
    galleryDisplayMode: state.galleryDisplayMode,
    appView: state.appView,
    themeMode: state.themeMode,
    activeModelId: state.activeModelId,
  }
}

function resolveGalleryDisplayMode(value: unknown): GalleryDisplayMode {
  return value === 'image' ? 'image' : 'standard'
}

function resolveAppView(value: unknown): AppView {
  if (value === 'square' || value === 'local' || value === 'models' || value === 'assets') return value
  return 'home'
}

function resolveThemeMode(value: unknown): AppThemeMode {
  if (value === 'light' || value === 'dark' || value === 'system') return value
  return 'system'
}

function mergePersistedParams(
  persistedParams: Partial<AppState>['params'],
  currentParams: AppState['params'],
): AppState['params'] {
  const mergedParams = {
    ...currentParams,
    ...persistedParams,
  }

  return {
    ...mergedParams,
    size: mergedParams.size === 'auto' ? currentParams.size : mergedParams.size,
    quality: mergedParams.quality === 'auto' ? currentParams.quality : mergedParams.quality,
  }
}

export function readPersistedAppStateSnapshot(input: unknown): PersistedAppStateSnapshot | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null
  }

  return input as PersistedAppStateSnapshot
}

export function mergePersistedAppState(
  persistedState: Partial<AppState> | undefined,
  currentState: AppState,
): AppState {
  const normalizedProviders = normalizeProviderList(persistedState?.providers)
  const normalizedCategories = normalizeCategoryList(persistedState?.categories)
  const normalizedPromptLibrary = normalizePromptLibraryItems(persistedState?.promptLibrary)
  const providerState =
    normalizedProviders.length > 0
      ? (() => {
          const activeProvider =
            normalizedProviders.find((provider) => provider.id === persistedState?.activeProviderId) ??
            normalizedProviders[0]

          return {
            providers: normalizedProviders,
            activeProviderId: activeProvider.id,
            settings: getProviderSettings(activeProvider),
          }
        })()
      : createInitialProviderState({
          ...currentState.settings,
          ...persistedState?.settings,
        })

  return {
    ...currentState,
    ...persistedState,
    settings: providerState.settings,
    providers: providerState.providers,
    activeProviderId: providerState.activeProviderId,
    categories: normalizedCategories,
    activeCategoryFilter: resolveActiveCategoryFilter(
      persistedState?.activeCategoryFilter,
      normalizedCategories,
    ),
    params: mergePersistedParams(persistedState?.params, currentState.params),
    promptLibrary: normalizedPromptLibrary,
    galleryDisplayMode: resolveGalleryDisplayMode(persistedState?.galleryDisplayMode),
    appView: resolveAppView(persistedState?.appView),
    themeMode: resolveThemeMode(persistedState?.themeMode),
    activeModelId:
      typeof persistedState?.activeModelId === 'string'
        ? persistedState.activeModelId
        : currentState.activeModelId,
  }
}
