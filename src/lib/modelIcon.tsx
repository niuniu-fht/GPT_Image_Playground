import type React from 'react'

export interface ModelIconPreset {
  value: string
  label: string
  mark: string
  className?: string
  /** 品牌内置图标：用内置 SVG 渲染而不是文字符号 */
  brand?: boolean
}

export const MODEL_ICON_PRESETS: ModelIconPreset[] = [
  { value: 'gpt', label: 'GPT', mark: '', brand: true },
  { value: 'gemini', label: 'Gemini', mark: '', brand: true },
  { value: 'seedream', label: 'Seedream', mark: '', brand: true },
  { value: 'grok', label: 'Grok', mark: '', brand: true },
  { value: 'sparkles', label: '星光', mark: '✨', className: 'bg-sky-50 text-sky-700 ring-sky-100' },
  { value: 'openai', label: '圆环', mark: '◎', className: 'bg-white text-slate-800 ring-gray-200' },
  { value: 'banana', label: '香蕉', mark: '🍌', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  { value: 'brush', label: '画笔', mark: '✎', className: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100' },
  { value: 'camera', label: '相机', mark: '◉', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
]

export const MODEL_ICON_MAX_BYTES = 96 * 1024

export function isUploadedModelIcon(icon: string): boolean {
  return icon.startsWith('data:image/')
}

export function getModelIconPreset(icon: string) {
  return MODEL_ICON_PRESETS.find((preset) => preset.value === icon) ?? MODEL_ICON_PRESETS[0]
}

// ---- 内置品牌图标（来源：simple-icons（CC0）官方路径 + 自绘 Seedream/即梦） ----

/** OpenAI 官方 logo 路径（simple-icons，CC0） */
const OPENAI_ICON_PATH =
  'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z'


/** Seedream（即梦）：官方 logo（来源 home.code2alita.com/icons/seedream.png，64×64） */
export function SeedreamBrandIcon({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <span className={`block overflow-hidden rounded-xl bg-white ${className}`}>
      <img src="/icons/seedream.png" alt="" className="h-full w-full object-cover" />
    </span>
  )
}

export function BrandGptIcon({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="5.5" fill="#0F0F0F" />
      <g transform="translate(3.6 3.6) scale(0.7)">
        <path d={OPENAI_ICON_PATH} fill="#FFFFFF" />
      </g>
    </svg>
  )
}

/** Gemini：官方多层渐变 star（来源 home.code2alita.com/icons/google.svg，即 lobe-icons 官方渲染） */
export function BrandGeminiIcon({ className = 'h-full w-full' }: { className?: string }) {
  const star =
    'M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z'
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d={star} fill="#3186FF" />
      <path d={star} fill="url(#brand-gemini-g0)" />
      <path d={star} fill="url(#brand-gemini-g1)" />
      <path d={star} fill="url(#brand-gemini-g2)" />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id="brand-gemini-g0" x1="7" x2="11" y1="15.5" y2="12">
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id="brand-gemini-g1" x1="8" x2="11.5" y1="5.5" y2="11">
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id="brand-gemini-g2" x1="3.5" x2="17.5" y1="13.5" y2="12">
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** Grok：黑底 + 蓝青渐变四角星 */
function BrandGrokIcon({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="brand-grok-gradient" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0" stopColor="#5EE6E0" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="5.5" fill="#0F0F0F" />
      <path
        d="M12 3.2c.45 3.4 1.5 5.6 3.05 6.75C16.6 11.1 18.8 11.55 20.8 12c-3.4.45-5.6 1.5-6.75 3.05C13.1 16.6 12.65 18.8 12 20.8c-.45-3.4-1.5-5.6-3.05-6.75C7.4 13.1 5.2 12.65 3.2 12c3.4-.45 5.6-1.5 6.75-3.05C11.1 7.4 11.55 5.2 12 3.2z"
        fill="url(#brand-grok-gradient)"
      />
      <path d="M17.5 4.5l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3z" fill="#9BE8F5" />
    </svg>
  )
}

const BRAND_MODEL_ICONS: Record<string, (props: { className?: string }) => React.ReactElement> = {
  gpt: BrandGptIcon,
  gemini: BrandGeminiIcon,
  seedream: SeedreamBrandIcon,
  grok: BrandGrokIcon,
}

// ---- 渲染入口 ----

export function renderModelIcon(icon: string, className = 'h-9 w-9'): React.ReactNode {
  if (isUploadedModelIcon(icon)) {
    return (
      <span className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-gray-100 shadow-sm ring-1 ring-gray-200 ${className}`}>
        <img src={icon} alt="" className="h-full w-full object-cover" />
      </span>
    )
  }

  const BrandIcon = BRAND_MODEL_ICONS[icon]
  if (BrandIcon) {
    return (
      <span className={`block shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-white/[0.08] ${className}`}>
        <BrandIcon />
      </span>
    )
  }

  const preset = getModelIconPreset(icon)
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl text-lg shadow-sm ring-1 ${preset.className ?? 'bg-gray-100 text-gray-600 ring-gray-200'} ${className}`}>
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
    reader.onerror = () => reject(reader.error ?? new Error('图标读取失败'))
    reader.readAsDataURL(file)
  })
}
