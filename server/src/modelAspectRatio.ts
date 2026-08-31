export const KNOWN_ASPECT_RATIOS = [
  '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9',
] as const

export type KnownAspectRatio = typeof KNOWN_ASPECT_RATIOS[number]

function parseSize(size: string): { width: number; height: number } | null {
  const match = size.match(/^\s*(\d+)\s*[xX×]\s*(\d+)\s*$/)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  return width > 0 && height > 0 ? { width, height } : null
}

export function resolveKnownAspectRatio(size: string): KnownAspectRatio | null {
  const dimensions = parseSize(size)
  if (!dimensions) return null
  const target = dimensions.width / dimensions.height
  const nearest = KNOWN_ASPECT_RATIOS
    .map((ratio) => {
      const [width, height] = ratio.split(':').map(Number)
      return { ratio, distance: Math.abs(Math.log(target / (width / height))) }
    })
    .sort((left, right) => left.distance - right.distance)[0]
  return nearest && nearest.distance <= 0.01 ? nearest.ratio : null
}

export function isModelAspectRatioEnabled(
  model: { unsupportedAspectRatios: string[] },
  size: string,
): boolean {
  const ratio = resolveKnownAspectRatio(size)
  return !ratio || !model.unsupportedAspectRatios.includes(ratio)
}
