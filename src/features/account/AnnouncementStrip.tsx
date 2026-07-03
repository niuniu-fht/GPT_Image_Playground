import { useState } from 'react'
import { useStore } from '../../store'
import type { AdminAnnouncement } from '../../types'

function announcementStyle(level: AdminAnnouncement['level']) {
  if (level === 'success') {
    return {
      shell: 'border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100',
      mark: 'bg-emerald-200/70 text-emerald-900 dark:bg-emerald-200/20 dark:text-emerald-100',
      hover: 'hover:bg-emerald-200/60 dark:hover:bg-white/[0.08]',
      symbol: '+',
    }
  }
  if (level === 'warning') {
    return {
      shell: 'border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100',
      mark: 'bg-amber-200/70 text-amber-900 dark:bg-amber-200/20 dark:text-amber-100',
      hover: 'hover:bg-amber-200/60 dark:hover:bg-white/[0.08]',
      symbol: '!',
    }
  }
  if (level === 'critical') {
    return {
      shell: 'border-rose-200/80 bg-rose-50 text-rose-900 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-100',
      mark: 'bg-rose-200/70 text-rose-900 dark:bg-rose-200/20 dark:text-rose-100',
      hover: 'hover:bg-rose-200/60 dark:hover:bg-white/[0.08]',
      symbol: '!',
    }
  }
  return {
    shell: 'border-blue-200/80 bg-blue-50 text-blue-900 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-100',
    mark: 'bg-blue-200/70 text-blue-900 dark:bg-blue-200/20 dark:text-blue-100',
    hover: 'hover:bg-blue-200/60 dark:hover:bg-white/[0.08]',
    symbol: 'i',
  }
}

export default function AnnouncementStrip({ placement = 'workspace' }: { placement?: AdminAnnouncement['placement'] }) {
  const announcements = useStore((state) => state.announcements)
  const [hiddenIds, setHiddenIds] = useState<string[]>([])
  const visible = announcements.filter((item) => {
    const hiddenKey = `${placement}:${item.id}`
    return (item.placement === 'global' || item.placement === placement) && !hiddenIds.includes(hiddenKey)
  })

  if (!visible.length) return null

  return (
    <div className="mb-4 space-y-2">
      {visible.map((item) => (
        <div key={item.id} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${announcementStyle(item.level).shell}`}>
          <span className={`mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-xs font-bold ${announcementStyle(item.level).mark}`}>
            {announcementStyle(item.level).symbol}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{item.title}</div>
            <div className="mt-1 whitespace-pre-wrap leading-6 opacity-80">{item.content}</div>
          </div>
          {item.actionLabel && item.actionUrl && (
            <a
              href={item.actionUrl}
              target={item.actionUrl.startsWith('http') ? '_blank' : undefined}
              rel={item.actionUrl.startsWith('http') ? 'noreferrer' : undefined}
              className={`rounded-full px-3 py-1 text-xs font-semibold opacity-80 transition hover:opacity-100 ${announcementStyle(item.level).hover}`}
            >
              {item.actionLabel}
            </a>
          )}
          <button
            type="button"
            onClick={() => setHiddenIds((ids) => [...ids, `${placement}:${item.id}`])}
            className={`rounded-full px-2 py-1 text-xs font-medium opacity-70 transition hover:opacity-100 ${announcementStyle(item.level).hover}`}
          >
            收起
          </button>
        </div>
      ))}
    </div>
  )
}
