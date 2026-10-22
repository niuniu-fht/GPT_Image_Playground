import { useEffect, useMemo, useState } from 'react'
import { platformApi } from '../../lib/platformApi'
import { useStore } from '../../store'
import type { AdminAnnouncement } from '../../types'

const READ_STORAGE_PREFIX = 'announcement-read-ids'
const OPEN_DELAY_MS = 800

function announcementTheme(level: AdminAnnouncement['level']) {
  if (level === 'success') {
    return {
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200',
      mark: 'bg-emerald-500',
      button: 'bg-emerald-600 hover:bg-emerald-500',
    }
  }
  if (level === 'warning') {
    return {
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200',
      mark: 'bg-amber-500',
      button: 'bg-amber-600 hover:bg-amber-500',
    }
  }
  if (level === 'critical') {
    return {
      badge: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-200',
      mark: 'bg-rose-500',
      button: 'bg-rose-600 hover:bg-rose-500',
    }
  }
  return {
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-200',
    mark: 'bg-blue-500',
    button: 'bg-blue-600 hover:bg-blue-500',
  }
}

function levelLabel(level: AdminAnnouncement['level']) {
  if (level === 'success') return '更新'
  if (level === 'warning') return '注意'
  if (level === 'critical') return '重要'
  return '公告'
}

function readStorageKey(userId: string | null) {
  return `${READ_STORAGE_PREFIX}:${userId ?? 'guest'}`
}

function readLocalReadIds(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeLocalReadIds(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids))))
  } catch {
    // 存储不可用时忽略：已读状态退化为仅服务端记录
  }
}

interface AnnouncementModalProps {
  placement?: AdminAnnouncement['placement']
}

export default function AnnouncementModal({ placement = 'workspace' }: AnnouncementModalProps) {
  const announcements = useStore((state) => state.announcements)
  const announcementsLoaded = useStore((state) => state.announcementsLoaded)
  const authReady = useStore((state) => state.authReady)
  const currentUser = useStore((state) => state.currentUser)
  const markAnnouncementRead = useStore((state) => state.markAnnouncementRead)
  const [readyToOpen, setReadyToOpen] = useState(false)
  const [localReadIds, setLocalReadIds] = useState<string[]>([])

  const storageKey = readStorageKey(currentUser?.id ?? null)

  useEffect(() => {
    if (!authReady) return
    setLocalReadIds(readLocalReadIds(readStorageKey(currentUser?.id ?? null)))
  }, [authReady, currentUser?.id])

  useEffect(() => {
    if (!authReady || !announcementsLoaded) return
    const timer = window.setTimeout(() => setReadyToOpen(true), OPEN_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [announcementsLoaded, authReady])

  const unread = useMemo(() => announcements.filter((item) => {
    if (item.placement !== 'global' && item.placement !== placement) return false
    return !item.read && !localReadIds.includes(item.id)
  }), [announcements, localReadIds, placement])

  const visible = readyToOpen && unread.length > 0
  const current = unread[0] ?? null

  const persistRead = (announcementId: string) => {
    setLocalReadIds((ids) => {
      const next = ids.includes(announcementId) ? ids : [...ids, announcementId]
      writeLocalReadIds(storageKey, next)
      return next
    })
    markAnnouncementRead(announcementId)
    if (currentUser) {
      void platformApi.markAnnouncementRead(announcementId).catch(() => undefined)
    }
  }

  const handleConfirm = () => {
    if (!current) return
    persistRead(current.id)
  }

  const handleDismissAll = () => {
    if (!unread.length) return
    for (const item of unread) {
      persistRead(item.id)
    }
  }

  useEffect(() => {
    if (!visible || unread.length <= 1) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleDismissAll()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, unread.map((item) => item.id).join(','), storageKey])

  if (!visible || !current) return null

  const theme = announcementTheme(current.level)
  const hasMore = unread.length > 1

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={current.title}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900 dark:ring-1 dark:ring-white/10">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white ${theme.mark}`} aria-hidden="true">
            {current.level === 'critical' || current.level === 'warning' ? '!' : 'i'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${theme.badge}`}>{levelLabel(current.level)}</span>
              {hasMore && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  1 / {unread.length}
                </span>
              )}
            </div>
            <h2 className="mt-1 truncate text-base font-semibold text-gray-900 dark:text-gray-50">{current.title}</h2>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
          <p className="whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">{current.content}</p>
          {current.actionLabel && current.actionUrl && (
            <a
              href={current.actionUrl}
              target={current.actionUrl.startsWith('http') ? '_blank' : undefined}
              rel={current.actionUrl.startsWith('http') ? 'noreferrer' : undefined}
              className="mt-3 inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:bg-white/[0.1]"
            >
              {current.actionLabel}
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-5 py-3.5 dark:border-white/[0.06]">
          {hasMore ? (
            <button
              type="button"
              onClick={handleDismissAll}
              className="rounded-lg px-3 py-2 text-xs font-medium text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              全部标为已读
            </button>
          ) : (
            <span className="text-xs text-gray-300 dark:text-gray-600">阅读后不再自动弹出</span>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${theme.button}`}
          >
            {hasMore ? `我知道了（还剩 ${unread.length - 1} 条）` : '我知道了'}
          </button>
        </div>
      </div>
    </div>
  )
}
