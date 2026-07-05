import type { AppView } from '../../types'

interface FutureFeaturePageProps {
  title: string
  eyebrow: string
  description: string
  primaryAction: string
  secondaryAction: string
  panels: Array<{
    title: string
    detail: string
    status: string
  }>
  setAppView: (view: AppView) => void
}

export default function FutureFeaturePage({
  title,
  eyebrow,
  description,
  primaryAction,
  secondaryAction,
  panels,
  setAppView,
}: FutureFeaturePageProps) {
  return (
    <section className="py-6 md:py-10">
      <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-gray-900">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.55fr)]">
          <div className="px-6 py-8 md:px-8 md:py-10">
            <div className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-300/15 dark:bg-blue-300/10 dark:text-blue-200">
              {eyebrow}
            </div>
            <h2 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-gray-950 dark:text-gray-50 md:text-5xl">
              {title}
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-gray-500 dark:text-gray-400 md:text-base">
              {description}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setAppView('local')}
                className="h-11 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-gray-950"
              >
                {primaryAction}
              </button>
              <button
                type="button"
                onClick={() => setAppView('square')}
                className="h-11 rounded-full border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.08]"
              >
                {secondaryAction}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 bg-gray-50/80 p-4 dark:border-white/[0.08] dark:bg-white/[0.03] lg:border-l lg:border-t-0">
            <div className="grid gap-3">
              {panels.map((panel) => (
                <div key={panel.title} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/[0.08] dark:bg-gray-950/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-gray-950 dark:text-gray-50">{panel.title}</div>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-500 dark:bg-white/[0.08] dark:text-gray-300">
                      {panel.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">{panel.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

