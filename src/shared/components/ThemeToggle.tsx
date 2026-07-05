import { useStore } from '../../store'
import type { AppThemeMode } from '../../types'

const THEME_OPTIONS: Array<{ mode: AppThemeMode; label: string; shortLabel: string }> = [
  { mode: 'system', label: '跟随系统', shortLabel: '系' },
  { mode: 'light', label: '浅色', shortLabel: '浅' },
  { mode: 'dark', label: '深色', shortLabel: '深' },
]

interface ThemeToggleProps {
  variant?: 'light' | 'dark'
}

export default function ThemeToggle({ variant = 'light' }: ThemeToggleProps) {
  const themeMode = useStore((state) => state.themeMode)
  const setThemeMode = useStore((state) => state.setThemeMode)

  const isDarkSurface = variant === 'dark'

  return (
    <div
      className={
        isDarkSurface
          ? 'inline-flex rounded-full border border-white/20 bg-black/20 p-0.5 shadow-sm backdrop-blur-xl'
          : 'inline-flex rounded-full border border-gray-200/80 bg-white/90 p-0.5 shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:bg-gray-900/90'
      }
      aria-label="主题切换"
    >
      {THEME_OPTIONS.map((option) => {
        const active = themeMode === option.mode
        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => setThemeMode(option.mode)}
            className={`h-8 rounded-full px-2.5 text-xs font-semibold transition ${
              active
                ? isDarkSurface
                  ? 'bg-white text-slate-950'
                  : 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                : isDarkSurface
                  ? 'text-white/70 hover:bg-white/12 hover:text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
            }`}
            title={option.label}
            aria-pressed={active}
          >
            <span className="sm:hidden">{option.shortLabel}</span>
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
