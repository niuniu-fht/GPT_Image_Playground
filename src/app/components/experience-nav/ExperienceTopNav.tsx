import { APP_VIEW_NAV_ITEMS } from '../../appRoutes'
import { ThemeToggle } from '../../../shared/components'
import type { AppView, CurrentUser } from '../../../types'

const PRODUCT_NAME = '造境 Proxima'

interface ExperienceTopNavProps {
  appView: AppView
  currentUser: CurrentUser | null
  onAdmin: () => void
  onLogin: () => void
  onNavigate: (view: AppView) => void
}

function navItemClass(active: boolean): string {
  return `inline-flex h-9 min-w-16 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
    active
      ? 'bg-white text-slate-950 shadow-[0_14px_32px_-22px_rgba(255,255,255,0.95)]'
      : 'text-white/78 hover:bg-white/12 hover:text-white'
  }`
}

export default function ExperienceTopNav({
  appView,
  currentUser,
  onAdmin,
  onLogin,
  onNavigate,
}: ExperienceTopNavProps) {
  return (
    <header className="relative z-30 mx-auto flex w-full max-w-7xl items-start justify-between gap-3 px-4 pt-4 text-white sm:items-center">
      <button
        type="button"
        onClick={() => onNavigate('home')}
        className="flex min-w-0 items-center gap-3 rounded-full pr-2 text-left transition hover:opacity-90"
        aria-label="返回首页"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-sm font-black text-slate-950 shadow-lg shadow-slate-950/15">
          ZJ
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm font-semibold tracking-tight">{PRODUCT_NAME}</span>
          <span className="block truncate text-xs text-white/68">AI Image Workspace</span>
        </span>
      </button>

      <nav
        className="absolute left-1/2 top-4 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-white/24 bg-black/20 p-1 shadow-[0_22px_70px_-44px_rgba(0,0,0,0.85)] backdrop-blur-2xl md:inline-flex"
        aria-label="主导航"
      >
        {APP_VIEW_NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            type="button"
            onClick={() => onNavigate(item.view)}
            className={navItemClass(appView === item.view)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle variant="dark" />
        {currentUser?.role === 'admin' && (
          <button
            type="button"
            onClick={onAdmin}
            className="hidden h-10 rounded-full border border-white/24 bg-white/12 px-4 text-sm font-semibold text-white shadow-sm backdrop-blur-xl transition hover:bg-white/20 sm:inline-flex sm:items-center"
          >
            运营后台
          </button>
        )}
        {!currentUser && (
          <button
            type="button"
            onClick={onLogin}
            className="h-10 rounded-full border border-white/24 bg-white/12 px-4 text-sm font-semibold text-white shadow-sm backdrop-blur-xl transition hover:bg-white/20"
          >
            登录
          </button>
        )}
      </div>

      <nav
        className="absolute left-4 right-4 top-[4.35rem] flex items-center gap-1 rounded-full border border-white/18 bg-black/20 p-1 backdrop-blur-2xl md:hidden"
        aria-label="移动端主导航"
      >
        {APP_VIEW_NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            type="button"
            onClick={() => onNavigate(item.view)}
            className={`h-9 flex-1 rounded-full text-xs font-semibold transition ${
              appView === item.view ? 'bg-white text-slate-950' : 'text-white/78 hover:bg-white/12'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
