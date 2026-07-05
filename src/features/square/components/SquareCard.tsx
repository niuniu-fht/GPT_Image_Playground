import type { SquareShareSummary } from '../../../types'
import type { SquareGridMetrics } from '../hooks/useSquareGridMetrics'
import { resolveSquareAssetUrl, summarizeSquareShare } from '../lib/squareApiClient'

interface SquareCardProps {
  item: SquareShareSummary
  metrics: SquareGridMetrics
  onOpenImage: (item: SquareShareSummary) => void
  onViewPrompt: (item: SquareShareSummary) => void
}

interface SquareCardLayout {
  columnSpan: number
  rowSpan: number
}

const TILE_RADIUS_CLASSES = [
  'rounded-[34px]',
  'rounded-[26px]',
  'rounded-[38px_26px_34px_26px]',
  'rounded-[26px_38px_26px_38px]',
]

function resolveTileRadiusClass(id: string): string {
  const total = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return TILE_RADIUS_CLASSES[total % TILE_RADIUS_CLASSES.length] ?? TILE_RADIUS_CLASSES[0]
}

function resolveCoverUrl(item: SquareShareSummary): string {
  const coverUrl = item.coverAsset?.originalUrl || item.coverAsset?.thumbUrl || ''
  return coverUrl ? resolveSquareAssetUrl(coverUrl) : ''
}

function resolveImageRatio(item: SquareShareSummary): number {
  const width = item.coverAsset?.width ?? 0
  const height = item.coverAsset?.height ?? 0
  const ratio = width > 0 && height > 0 ? width / height : 0.8
  return Math.max(0.48, Math.min(ratio, 2.35))
}

function resolveColumnSpan(ratio: number, metrics: SquareGridMetrics): number {
  if (metrics.columnCount < 2) return 1
  return ratio >= 1.22 ? 2 : 1
}

function resolveCardLayout(item: SquareShareSummary, metrics: SquareGridMetrics): SquareCardLayout {
  const ratio = resolveImageRatio(item)
  const columnSpan = resolveColumnSpan(ratio, metrics)
  const cardWidth = metrics.columnWidth * columnSpan + metrics.gap * (columnSpan - 1)
  const targetHeight = cardWidth / ratio
  const rowUnit = metrics.rowHeight + metrics.gap
  const rowSpan = Math.max(10, Math.ceil((targetHeight + metrics.gap) / rowUnit))

  return { columnSpan, rowSpan }
}

export default function SquareCard({ item, metrics, onOpenImage, onViewPrompt }: SquareCardProps) {
  const coverUrl = resolveCoverUrl(item)
  if (!coverUrl) return null

  const title = summarizeSquareShare(item)
  const layout = resolveCardLayout(item, metrics)

  return (
    <article
      data-square-card-root
      className={`group relative min-h-[160px] select-none overflow-hidden bg-[#141414] shadow-[0_28px_80px_-48px_rgba(0,0,0,0.95)] ${resolveTileRadiusClass(item.id)}`}
      style={{
        gridColumnEnd: `span ${layout.columnSpan}`,
        gridRowEnd: `span ${layout.rowSpan}`,
      }}
      onDragStart={(event) => event.preventDefault()}
    >
      <button
        type="button"
        onClick={() => onOpenImage(item)}
        className="block h-full w-full cursor-zoom-in overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-white/70"
        aria-label={`查看 ${title}`}
      >
        <img
          src={coverUrl}
          alt={title}
          loading="lazy"
          draggable={false}
          className="h-full w-full select-none object-cover transition duration-700 ease-out group-hover:scale-[1.045] group-hover:brightness-90"
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 translate-y-3 px-5 pb-5 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="line-clamp-2 text-[15px] font-semibold leading-5 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)]">
            {title}
          </span>
        </span>
      </button>

      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,transparent_44%,rgba(0,0,0,0.58)_100%)] opacity-0 transition duration-300 group-hover:opacity-100" />

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onViewPrompt(item)
        }}
        className="absolute right-3 top-3 z-20 grid h-10 w-10 translate-y-1 place-items-center rounded-full border border-white/22 bg-black/38 text-white opacity-0 shadow-2xl backdrop-blur-xl transition duration-300 hover:bg-white hover:text-black group-hover:translate-y-0 group-hover:opacity-100 focus:translate-y-0 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/70"
        aria-label="查看提示词"
        title="查看提示词"
      >
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
        </svg>
      </button>
    </article>
  )
}
