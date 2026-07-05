import { MODEL_ICON_PRESETS, readModelIconFile, renderModelIcon } from '../../../../lib/modelIcon'
import { cx } from '../shared'

interface ModelIconPickerProps {
  value: string
  onChange: (value: string) => void
  onError: (message: string) => void
}

export function ModelIconPicker({ value, onChange, onError }: ModelIconPickerProps) {
  async function handleUpload(file: File | undefined) {
    if (!file) return
    try {
      onChange(await readModelIconFile(file))
    } catch (error) {
      onError(error instanceof Error ? error.message : '图标上传失败')
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/[0.08] dark:bg-gray-950">
      <div className="flex items-start gap-3">
        {renderModelIcon(value, 'h-14 w-14')}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-950 dark:text-gray-50">模型图标</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">选择预设图标，或上传不超过 96KB 的图片作为前台展示图标。</div>
          <label className="mt-3 inline-flex h-9 cursor-pointer items-center rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-200 dark:hover:bg-white/[0.06]">
            上传图标
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                void handleUpload(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </label>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2">
        {MODEL_ICON_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onChange(preset.value)}
            className={cx(
              'flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs transition',
              value === preset.value
                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-200'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]',
            )}
          >
            <span className="text-lg">{preset.mark}</span>
            <span>{preset.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
