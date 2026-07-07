import { strToU8, zipSync } from 'fflate'
import { getImageRecord } from '../../../lib/db'
import { getImageExtensionFromMimeType } from '../../../lib/imageMime'
import type { StoredImage, TaskRecord } from '../../../types'

type ZipFileEntry = Uint8Array | [Uint8Array, { mtime: Date }]

interface ExportedImageManifest {
  byteSize?: number | null
  error?: string
  filePath?: string
  imageId: string
  imageIndex: number
  mimeType?: string | null
  status: 'exported' | 'failed'
}

interface ExportedTaskManifest {
  createdAt: string
  id: string
  images: ExportedImageManifest[]
  modelDisplayName?: string | null
  modelName?: string | null
  params: TaskRecord['params']
  prompt: string
}

export interface GalleryImageExportResult {
  exportedImageCount: number
  failedImageCount: number
  skippedTaskCount: number
  taskCount: number
}

function sanitizePathSegment(value: string, fallback: string): string {
  const normalized = value
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48)
  return normalized || fallback
}

function taskFolderName(task: TaskRecord, taskIndex: number): string {
  const serial = String(taskIndex + 1).padStart(3, '0')
  const title = sanitizePathSegment(
    task.prompt || task.modelDisplayName || task.modelName || task.id,
    'untitled',
  )
  return `${serial}-${title}`
}

function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer))
}

function resolveRecordMimeType(record: StoredImage, blob?: Blob): string {
  if (record.mimeType) return record.mimeType
  if (blob?.type) return blob.type
  return 'image/png'
}

async function readStoredImageAsBlob(record: StoredImage): Promise<Blob> {
  if (record.kind === 'local_blob') return record.blob

  if (record.kind === 'legacy_data_url') {
    const response = await fetch(record.dataUrl)
    if (!response.ok) {
      throw new Error(`data URL 读取失败：HTTP ${response.status}`)
    }
    return response.blob()
  }

  const response = await fetch(record.remoteUrl)
  if (!response.ok) {
    throw new Error(`远程图片读取失败：HTTP ${response.status}`)
  }
  return response.blob()
}

function downloadZip(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function buildFailureMessage(error: unknown): string {
  if (error instanceof TypeError || error instanceof DOMException) {
    return '图片源站禁止跨域读取或网络不可用'
  }
  return error instanceof Error ? error.message : '图片读取失败'
}

export function countTaskOutputImages(tasks: TaskRecord[]): number {
  return tasks.reduce((sum, task) => sum + task.outputImages.length, 0)
}

export async function exportGalleryImagesZip(tasks: TaskRecord[]): Promise<GalleryImageExportResult> {
  const exportedAt = Date.now()
  const zipFiles: Record<string, ZipFileEntry> = {}
  const manifestTasks: ExportedTaskManifest[] = []
  let exportedImageCount = 0
  let failedImageCount = 0
  let skippedTaskCount = 0

  for (let taskIndex = 0; taskIndex < tasks.length; taskIndex += 1) {
    const task = tasks[taskIndex]
    if (!task.outputImages.length) {
      skippedTaskCount += 1
      continue
    }

    const folder = taskFolderName(task, taskIndex)
    const taskManifest: ExportedTaskManifest = {
      id: task.id,
      prompt: task.prompt,
      modelName: task.modelName,
      modelDisplayName: task.modelDisplayName,
      params: task.params,
      createdAt: new Date(task.createdAt).toISOString(),
      images: [],
    }

    for (let imageIndex = 0; imageIndex < task.outputImages.length; imageIndex += 1) {
      const imageId = task.outputImages[imageIndex]

      try {
        const record = await getImageRecord(imageId)
        if (!record) {
          throw new Error('本地图片记录不存在')
        }

        const blob = await readStoredImageAsBlob(record)
        const mimeType = resolveRecordMimeType(record, blob)
        const extension = getImageExtensionFromMimeType(mimeType)
        const filePath = `images/${folder}/${String(imageIndex + 1).padStart(2, '0')}.${extension}`
        zipFiles[filePath] = [
          await blobToBytes(blob),
          { mtime: new Date(record.createdAt ?? task.createdAt ?? exportedAt) },
        ]
        exportedImageCount += 1
        taskManifest.images.push({
          imageId,
          imageIndex,
          status: 'exported',
          filePath,
          mimeType,
          byteSize: blob.size || record.byteSize || null,
        })
      } catch (error) {
        failedImageCount += 1
        taskManifest.images.push({
          imageId,
          imageIndex,
          status: 'failed',
          error: buildFailureMessage(error),
        })
      }
    }

    manifestTasks.push(taskManifest)
  }

  if (!exportedImageCount && !failedImageCount) {
    return {
      exportedImageCount,
      failedImageCount,
      skippedTaskCount,
      taskCount: tasks.length,
    }
  }

  const manifest = {
    version: 1,
    exportedAt: new Date(exportedAt).toISOString(),
    taskCount: tasks.length,
    exportedImageCount,
    failedImageCount,
    skippedTaskCount,
    tasks: manifestTasks,
  }
  zipFiles['manifest.json'] = [
    strToU8(JSON.stringify(manifest, null, 2)),
    { mtime: new Date(exportedAt) },
  ]

  const zipped = zipSync(zipFiles, { level: 6 })
  const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' })
  downloadZip(blob, `gallery-images-${new Date(exportedAt).toISOString().slice(0, 10)}-${exportedAt}.zip`)

  return {
    exportedImageCount,
    failedImageCount,
    skippedTaskCount,
    taskCount: tasks.length,
  }
}
