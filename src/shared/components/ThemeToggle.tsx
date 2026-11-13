import { useStore } from '../../store'
import type { AppThemeMode } from '../../types'

const THEME_CYCLE: Array<{ mode: AppThemeMode; label: string }> = [
  { mode: 'system', label: '跟随系统' },
  { mode: 'light', label: '浅色' },
  { mode: 'dark', label: '深色' },
]

interface ThemeToggleProps {
  variant?: 'light' | 'dark'
}

function ThemeIcon({ mode, className = 'h-4 w-4' }: { mode: AppThemeMode; className?: string }) {
  if (mode === 'light') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    )
  }
  if (mode === 'dark') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    )
  }
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h3M4 6h16M5 6l1 9a2 2 0 002 2h8a2 2 0 002-2l1-9M12 3v3m-4 7h.01M16 13h.01"
      />
    </svg>
  )
}

export default function ThemeToggle({ variant = 'light' }: ThemeToggleProps) {
  const themeMode = useStore((state) => state.themeMode)
  const setThemeMode = useStore((state) => state.setThemeMode)

  const isDarkSurface = variant === 'dark'
  const currentIndex = THEME_CYCLE.findIndex((item) => item.mode === themeMode)
  const current = THEME_CYCLE[currentIndex >= 0 ? currentIndex : 0]
  const next = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length]

  return (
    <button
      type="button"
      onClick={() => setThemeMode(next.mode)}
      aria-label={`主题：${current.label}，点击切换为${next.label}`}
      title={`当前：${current.label}（点击切换为${next.label}）`}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border shadow-sm backdrop-blur-xl transition ${
        isDarkSurface
          ? 'border-white/20 bg-black/20 text-white/80 hover:bg-black/30 hover:text-white'
          : 'border-gray-200/80 bg-white/90 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:border-white/[0.08] dark:bg-gray-900/90 dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
      }`}
    >
      <ThemeIcon mode={current.mode} />
    </button>
  )
}
