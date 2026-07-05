import type { AppState } from '../contracts'

export type StoreSet = (
  partial: Partial<AppState> | ((state: AppState) => Partial<AppState>),
) => void
