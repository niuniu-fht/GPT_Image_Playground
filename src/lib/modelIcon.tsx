import type React from 'react'

export const MODEL_ICON_PRESETS = [
  { value: 'sparkles', label: '星光', mark: '✨', className: 'bg-sky-50 text-sky-700 ring-sky-100' },
  { value: 'openai', label: '圆环', mark: '◎', className: 'bg-white text-slate-800 ring-gray-200' },
  { value: 'banana', label: '香蕉', mark: '🍌', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  { value: 'brush', label: '画笔', mark: '✎', className: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100' },
  { value: 'camera', label: '相机', mark: '◉', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
] as const

export const MODEL_ICON_MAX_BYTES = 96 * 1024

export function isUploadedModelIcon(icon: string): boolean {
  return icon.startsWith('data:image/')
}

export function getModelIconPreset(icon: string) {
  return MODEL_ICON_PRESETS.find((preset) => preset.value === icon) ?? MODEL_ICON_PRESETS[0]
}

export function renderModelIcon(icon: string, className = 'h-9 w-9'): React.ReactNode {
  if (isUploadedModelIcon(icon)) {
    return (
      <span className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-gray-100 shadow-sm ring-1 ring-gray-200 ${className}`}>
        <img src={icon} alt="" className="h-full w-full object-cover" />
      </span>
    )
  }

  const preset = getModelIconPreset(icon)
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl text-lg shadow-sm ring-1 ${preset.className} ${className}`}>
      {preset.mark}
    </span>
  )
}

export function readModelIconFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('请上传图片格式的图标'))
  }
  if (file.size > MODEL_ICON_MAX_BYTES) {
    return Promise.reject(new Error('图标不能超过 96KB'))
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('图标读取失败'))
    }
    reader.onerror = () => reject(new Error('图标读取失败'))
    reader.readAsDataURL(file)
  })
}
