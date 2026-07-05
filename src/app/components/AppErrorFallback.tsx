interface AppErrorFallbackProps {
  error: Error
  onReload: () => void
  onReset: () => void
}

function getErrorSummary(error: Error): string {
  if (import.meta.env.DEV) {
    return error.message || '未知异常'
  }

  return '页面运行时遇到异常，请刷新后重试。'
}

export default function AppErrorFallback({ error, onReload, onReset }: AppErrorFallbackProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/8 dark:border-white/[0.10] dark:bg-slate-900">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-lg font-black text-rose-600 dark:bg-rose-400/10 dark:text-rose-200">
          !
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">页面暂时不可用</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          操作没有完成。你可以先刷新页面，如果问题反复出现，请把当前操作步骤反馈给管理员。
        </p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400">
          {getErrorSummary(error)}
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onReload}
            className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            刷新页面
          </button>
          <button
            type="button"
            onClick={onReset}
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/[0.12] dark:text-slate-200 dark:hover:bg-white/[0.06]"
          >
            回到首页
          </button>
        </div>
      </section>
    </main>
  )
}
