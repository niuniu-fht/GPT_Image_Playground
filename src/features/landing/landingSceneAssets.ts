import { CanvasTexture, SRGBColorSpace } from 'three'

export const PARTICLE_COUNT = 620
export const BRAND_COLORS = [0x60a5fa, 0x34d399, 0xfacc15, 0xf472b6]

export interface ParticleSeed {
  angle: number
  radius: number
  height: number
  speed: number
  size: number
}

const PREVIEW_PALETTES = [
  ['#38bdf8', '#60a5fa', '#f8fafc', '#0f172a'],
  ['#f472b6', '#fb7185', '#fde68a', '#111827'],
  ['#a78bfa', '#38bdf8', '#f0f9ff', '#172554'],
  ['#facc15', '#34d399', '#e0f2fe', '#1e293b'],
]

const PREVIEW_TITLES = ['Commerce hero', 'Portrait remix', 'ID photo', 'Interior poster']
const PREVIEW_DETAILS = ['product to campaign', 'snapshot to cover', 'clean studio output', 'room to lifestyle']

function createTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

function drawSoftGrid(context: CanvasRenderingContext2D, width: number, height: number) {
  context.save()
  context.globalAlpha = 0.2
  context.strokeStyle = '#ffffff'
  context.lineWidth = 1
  for (let x = 48; x < width; x += 56) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, height)
    context.stroke()
  }
  for (let y = 56; y < height; y += 56) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(width, y)
    context.stroke()
  }
  context.restore()
}

export function createParticleSeeds(): ParticleSeed[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => {
    const ratio = index / PARTICLE_COUNT
    return {
      angle: ratio * Math.PI * 9,
      radius: 1.4 + Math.sin(index * 12.9898) * 0.5 + (index % 11) * 0.018,
      height: (ratio - 0.5) * 3.8,
      speed: 0.14 + (index % 7) * 0.018,
      size: 0.018 + (index % 5) * 0.004,
    }
  })
}

export function createPreviewTexture(index: number): CanvasTexture {
  const palette = PREVIEW_PALETTES[index % PREVIEW_PALETTES.length]
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 680
  const context = canvas.getContext('2d')
  if (!context) return createTexture(canvas)

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, palette[0])
  gradient.addColorStop(0.46, palette[1])
  gradient.addColorStop(1, palette[2])
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  drawSoftGrid(context, canvas.width, canvas.height)

  const radial = context.createRadialGradient(150, 160, 20, 210, 230, 420)
  radial.addColorStop(0, 'rgba(255,255,255,0.86)')
  radial.addColorStop(0.46, 'rgba(255,255,255,0.14)')
  radial.addColorStop(1, 'rgba(15,23,42,0.34)')
  context.fillStyle = radial
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.save()
  context.globalCompositeOperation = 'screen'
  for (let row = 0; row < 9; row += 1) {
    context.beginPath()
    const y = 96 + row * 58
    context.moveTo(-40, y)
    context.bezierCurveTo(140, y - 78, 320, y + 96, 560, y - 28)
    context.lineWidth = 2 + (row % 3)
    context.strokeStyle = `rgba(255,255,255,${0.16 + row * 0.018})`
    context.stroke()
  }
  context.restore()

  context.fillStyle = palette[3]
  context.font = '700 38px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  context.fillText(PREVIEW_TITLES[index % PREVIEW_TITLES.length], 34, 604)
  context.font = '500 20px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  context.fillText(PREVIEW_DETAILS[index % PREVIEW_DETAILS.length], 34, 636)
  return createTexture(canvas)
}

export function createPortalTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 760
  canvas.height = 520
  const context = canvas.getContext('2d')
  if (!context) return createTexture(canvas)

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#e0f2fe')
  gradient.addColorStop(0.38, '#93c5fd')
  gradient.addColorStop(0.72, '#f9a8d4')
  gradient.addColorStop(1, '#fef3c7')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  drawSoftGrid(context, canvas.width, canvas.height)

  context.save()
  context.globalCompositeOperation = 'screen'
  for (let i = 0; i < 18; i += 1) {
    const radius = 44 + i * 20
    context.beginPath()
    context.ellipse(396, 250, radius * 1.34, radius, -0.36, 0, Math.PI * 2)
    context.strokeStyle = `rgba(255,255,255,${0.3 - i * 0.012})`
    context.lineWidth = 3
    context.stroke()
  }
  context.restore()

  context.fillStyle = 'rgba(15,23,42,0.72)'
  context.font = '800 42px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  context.fillText('Before to Result', 56, 410)
  context.font = '600 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  context.fillText('product, portrait, ID photo, interior poster', 58, 446)
  return createTexture(canvas)
}

export function createPromptTexture(text: string, accent: string): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 420
  canvas.height = 92
  const context = canvas.getContext('2d')
  if (!context) return createTexture(canvas)

  context.fillStyle = 'rgba(255,255,255,0.78)'
  context.roundRect(6, 8, 408, 76, 38)
  context.fill()
  context.strokeStyle = 'rgba(148,163,184,0.34)'
  context.lineWidth = 2
  context.stroke()
  context.fillStyle = accent
  context.beginPath()
  context.arc(46, 46, 8, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#0f172a'
  context.font = '700 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  context.fillText(text, 70, 55)
  return createTexture(canvas)
}
