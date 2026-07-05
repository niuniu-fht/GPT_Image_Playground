import type { AppView } from '../types'

export interface AppViewRouteMeta {
  label: string
  path: string
  title: string
  view: AppView
}

export const APP_VIEW_ROUTES: Record<AppView, AppViewRouteMeta> = {
  home: { label: '首页', path: '/', title: '造境 Proxima', view: 'home' },
  local: { label: '创作台', path: '/workspace', title: '创作台 - 造境 Proxima', view: 'local' },
  square: { label: '作品广场', path: '/square', title: '作品广场 - 造境 Proxima', view: 'square' },
  models: { label: '模型中心', path: '/models', title: '模型中心 - 造境 Proxima', view: 'models' },
  assets: { label: '资产库', path: '/library', title: '资产库 - 造境 Proxima', view: 'assets' },
}

export const APP_VIEW_NAV_ITEMS: AppViewRouteMeta[] = [
  APP_VIEW_ROUTES.home,
  APP_VIEW_ROUTES.local,
  APP_VIEW_ROUTES.square,
]

const APP_VIEW_ROUTE_ITEMS: AppViewRouteMeta[] = [
  ...APP_VIEW_NAV_ITEMS,
  APP_VIEW_ROUTES.models,
  APP_VIEW_ROUTES.assets,
]

export function resolveAppViewPath(view: AppView): string {
  return APP_VIEW_ROUTES[view].path
}

export function resolveAppViewTitle(view: AppView): string {
  return APP_VIEW_ROUTES[view].title
}

export function resolveAppViewFromPath(pathname: string): AppView | null {
  const normalizedPath = pathname === '' ? '/' : pathname
  const route = APP_VIEW_ROUTE_ITEMS.find((item) => item.path === normalizedPath)
  if (route) return route.view
  return null
}
