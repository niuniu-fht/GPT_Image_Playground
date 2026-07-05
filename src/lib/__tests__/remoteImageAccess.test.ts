import { describe, expect, it } from 'vitest'
import { RemoteImageAccessError, resolveRemoteImageAccessMessage } from '../remoteImageAccess'

describe('resolveRemoteImageAccessMessage', () => {
  it('keeps explicit image access errors', () => {
    const error = new RemoteImageAccessError('图片读取失败：HTTP 403')

    expect(resolveRemoteImageAccessMessage(error, 'read')).toBe('图片读取失败：HTTP 403')
  })

  it('explains CORS failures for copy actions', () => {
    const message = resolveRemoteImageAccessMessage(new TypeError('Failed to fetch'), 'copy')

    expect(message).toContain('源站禁止跨域读取')
    expect(message).toContain('打开原图')
  })

  it('explains download fallback when cross-origin fetch is blocked', () => {
    const message = resolveRemoteImageAccessMessage(new TypeError('Failed to fetch'), 'download')

    expect(message).toBe('图片源站禁止跨域下载，已尝试打开原图。')
  })
})

