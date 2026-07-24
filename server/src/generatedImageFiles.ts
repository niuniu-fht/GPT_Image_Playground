import crypto from 'node:crypto'
import { mkdir, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from './env.js'

const SWEEP_INTERVAL_MS = 15 * 60 * 1000
const generatedImageRoot = path.resolve(env.generatedImageDir)

const MIME_EXTENSIONS: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

let sweepTimer: ReturnType<typeof setInterval> | null = null

function taskDirectoryName(taskId: string): string {
  return crypto.createHash('sha256').update(taskId).digest('hex')
}

function normalizeImageIndex(index: number): number {
  if (!Number.isInteger(index) || index < 0 || index > 999) {
    throw new Error(`Invalid generated image index: ${index}`)
  }
  return index
}

function extensionForMimeType(mimeType: string): string {
  return MIME_EXTENSIONS[mimeType.toLowerCase()] ?? 'bin'
}

function taskDirectoryPath(taskId: string): string {
  return path.join(generatedImageRoot, taskDirectoryName(taskId))
}

export function buildGeneratedImageDeliveryUrl(taskId: string, index: number): string {
  return `/api/generations/${encodeURIComponent(taskId)}/images/${normalizeImageIndex(index)}`
}

export function getGeneratedImageFilePath(taskId: string, index: number, mimeType: string): string {
  const filename = `${normalizeImageIndex(index)}.${extensionForMimeType(mimeType)}`
  return path.join(taskDirectoryPath(taskId), filename)
}

export async function writeGeneratedImageFile(input: {
  bytes: Buffer
  index: number
  mimeType: string
  taskId: string
}): Promise<string> {
  const directory = taskDirectoryPath(input.taskId)
  const destination = getGeneratedImageFilePath(input.taskId, input.index, input.mimeType)
  const temporary = `${destination}.${crypto.randomBytes(6).toString('hex')}.tmp`

  await mkdir(directory, { recursive: true })
  try {
    await writeFile(temporary, input.bytes, { flag: 'wx' })
    await rename(temporary, destination)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw error
  }

  return buildGeneratedImageDeliveryUrl(input.taskId, input.index)
}

export async function deleteGeneratedImageFilesForTasks(taskIds: string[]): Promise<number> {
  const uniqueTaskIds = Array.from(new Set(taskIds.filter(Boolean)))
  let deleted = 0

  for (const taskId of uniqueTaskIds) {
    const directory = taskDirectoryPath(taskId)
    const entries = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return []
      throw error
    })
    await rm(directory, { recursive: true, force: true })
    deleted += entries.filter((entry) => !entry.endsWith('.tmp')).length
  }

  return deleted
}

export function scheduleGeneratedImageFileDeletion(input: {
  filePath: string
  taskId: string
}): void {
  const timer = setTimeout(() => {
    void unlink(input.filePath)
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') {
          console.warn('[generation-files] failed to delete delivered image', error)
        }
      })
      .then(async () => {
        const directory = taskDirectoryPath(input.taskId)
        const entries = await readdir(directory).catch(() => [])
        if (entries.length === 0) {
          await rm(directory, { recursive: true, force: true })
        }
      })
  }, env.generatedImageDeliveryGraceSeconds * 1000)
  timer.unref?.()
}

export async function sweepExpiredGeneratedImageFiles(now = Date.now()): Promise<number> {
  await mkdir(generatedImageRoot, { recursive: true })
  const entries = await readdir(generatedImageRoot, { withFileTypes: true })
  const cutoff = now - env.generatedImageRetentionSeconds * 1000
  let deleted = 0

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const directory = path.join(generatedImageRoot, entry.name)
    const directoryStat = await stat(directory).catch(() => null)
    if (!directoryStat || directoryStat.mtimeMs > cutoff) continue
    const files = await readdir(directory).catch(() => [])
    await rm(directory, { recursive: true, force: true })
    deleted += files.filter((file) => !file.endsWith('.tmp')).length
  }

  return deleted
}

export function startGeneratedImageFileSweep(): void {
  if (sweepTimer) return

  void sweepExpiredGeneratedImageFiles().catch((error: unknown) => {
    console.error('[generation-files] initial sweep failed', error)
  })
  sweepTimer = setInterval(() => {
    void sweepExpiredGeneratedImageFiles().catch((error: unknown) => {
      console.error('[generation-files] sweep failed', error)
    })
  }, SWEEP_INTERVAL_MS)
  sweepTimer.unref?.()
}
