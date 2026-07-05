import { useState } from 'react'
import { APP_VIEW_NAV_ITEMS } from '../../appRoutes'
import type { AppView } from '../../../types'

interface HeaderProductNavProps {
  appView: AppView
  setAppView: (view: AppView) => void
}

function navButtonClass(active: boolean) {
  return `inline-flex h-9 w-20 items-center justify-center rounded-full px-3 text-sm font-semibold transition ${
    active
      ? 'bg-slate-950 text-white shadow-[0_14px_30px_-20px_rgba(15,23,42,0.8)] dark:bg-white dark:text-slate-950'
      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]'
  }`
}

export function HeaderProductNav({ appView, setAppView }: HeaderProductNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  function switchView(view: AppView) {
    setAppView(view)
    setMobileOpen(false)
  }

  return (
    <>
      <button type="button" onClick={() => switchView('home')} className="min-w-0 flex-1 text-left">
        <h1 className="truncate text-[15px] font-bold tracking-tight text-gray-800 transition hover:text-gray-950 dark:text-gray-100 dark:hover:text-white sm:text-base">
          造境 Proxima
        </h1>
        <p className="hidden truncate text-[11px] leading-4 text-gray-500 dark:text-gray-400 md:block">
          输入提示词生成图片，管理作品，并把精选内容发布到广场。
        </p>
      </button>

      <nav
        className="fixed left-1/2 top-4 z-50 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-gray-200/80 bg-white/90 p-1 shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:bg-gray-900/90 sm:inline-flex"
        aria-label="主导航"
      >
        {APP_VIEW_NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            type="button"
            onClick={() => switchView(item.view)}
            className={navButtonClass(appView === item.view)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200/80 bg-white/90 px-2.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 dark:border-white/[0.08] dark:bg-gray-900/90 dark:text-gray-200 dark:hover:bg-white/[0.06]"
          aria-expanded={mobileOpen}
          aria-label="打开功能导航"
        >
          功能
          <svg className={`h-3.5 w-3.5 transition ${mobileOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {mobileOpen && (
          <nav
            className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl shadow-gray-950/12 dark:border-white/[0.10] dark:bg-gray-900"
            aria-label="移动端主导航"
          >
            {APP_VIEW_NAV_ITEMS.map((item) => (
              <button
                key={item.view}
                type="button"
                onClick={() => switchView(item.view)}
                className={`flex h-9 w-full items-center justify-between rounded-xl px-3 text-left text-xs font-semibold transition ${
                  appView === item.view
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.06]'
                }`}
              >
                {item.label}
                {appView === item.view && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </button>
            ))}
          </nav>
        )}
      </div>
    </>
  )
}
