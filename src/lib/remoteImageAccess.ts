export class RemoteImageAccessError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'RemoteImageAccessError'
  }
}

function isNetworkOrCorsFailure(error: unknown): boolean {
  return error instanceof TypeError || error instanceof DOMException
}

export function resolveRemoteImageAccessMessage(error: unknown, action: 'copy' | 'download' | 'read'): string {
  if (error instanceof RemoteImageAccessError) {
    return error.message
  }

  if (isNetworkOrCorsFailure(error)) {
    if (action === 'copy') {
      return '图片源站禁止跨域读取，无法直接复制。请先打开原图后保存。'
    }
    if (action === 'download') {
      return '图片源站禁止跨域下载，已尝试打开原图。'
    }
    return '图片源站禁止跨域读取，请检查图片域名的 CORS 配置。'
  }

  return error instanceof Error ? error.message : '图片读取失败，请稍后重试'
}

export async function fetchImageBlobWithFriendlyError(src: string): Promise<Blob> {
  try {
    const response = await fetch(src)
    if (!response.ok) {
      throw new RemoteImageAccessError(`图片读取失败：HTTP ${response.status}`)
    }

    return await response.blob()
  } catch (error) {
    if (error instanceof RemoteImageAccessError) {
      throw error
    }

    throw new RemoteImageAccessError(resolveRemoteImageAccessMessage(error, 'read'), error)
  }
}

