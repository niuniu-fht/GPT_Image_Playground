import { mkdtemp, readFile, rm, stat, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let testRoot = ''

describe('generated image file delivery', () => {
  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), 'gip-generated-files-'))
    process.env.GENERATED_IMAGE_DIR = testRoot
    process.env.GENERATED_IMAGE_RETENTION_SECONDS = '60'
    vi.resetModules()
  })

  afterEach(async () => {
    delete process.env.GENERATED_IMAGE_DIR
    delete process.env.GENERATED_IMAGE_RETENTION_SECONDS
    await rm(testRoot, { recursive: true, force: true })
  })

  it('writes binary output and returns a database-safe delivery path', async () => {
    const files = await import('../generatedImageFiles.js')
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const deliveryUrl = await files.writeGeneratedImageFile({
      bytes,
      index: 2,
      mimeType: 'image/png',
      taskId: 'task-1',
    })

    expect(deliveryUrl).toBe('/api/generations/task-1/images/2')
    const filePath = files.getGeneratedImageFilePath('task-1', 2, 'image/png')
    await expect(readFile(filePath)).resolves.toEqual(bytes)
  })

  it('removes expired task directories without relying on database content', async () => {
    const files = await import('../generatedImageFiles.js')
    await files.writeGeneratedImageFile({
      bytes: Buffer.from('image'),
      index: 0,
      mimeType: 'image/webp',
      taskId: 'expired-task',
    })
    const filePath = files.getGeneratedImageFilePath('expired-task', 0, 'image/webp')
    const directory = path.dirname(filePath)
    const old = new Date(Date.now() - 120_000)
    await utimes(directory, old, old)

    await expect(files.sweepExpiredGeneratedImageFiles()).resolves.toBe(1)
    await expect(stat(directory)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
