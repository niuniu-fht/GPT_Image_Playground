import { fetchImageBlobWithFriendlyError } from './remoteImageAccess'

function resolveImageExtension(blob: Blob): string {
  const subtype = blob.type.split('/')[1]?.split(';')[0]?.trim().toLowerCase()
  if (!subtype) return 'png'
  if (subtype === 'jpeg') return 'jpg'
  if (subtype === 'svg+xml') return 'svg'
  return subtype.replace(/[^a-z0-9]/g, '') || 'png'
}

export async function downloadImageFromSrc(src: string, filenamePrefix = 'image'): Promise<void> {
  const blob = await fetchImageBlobWithFriendlyError(src)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${filenamePrefix}-${Date.now()}.${resolveImageExtension(blob)}`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
