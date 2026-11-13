import { Zip, ZipDeflate } from 'fflate'
import { getImageRecord } from '../../../lib/db'
import { getImageExtensionFromMimeType } from '../../../lib/imageMime'
import type { StoredImage, TaskRecord } from '../../../types'

export interface GalleryImageExportResult {
  exportedImageCount: number
  failedImageCount: number
  skippedTaskCount: number
  taskCount: number
}

function buildFlatImageFileName(
  exportId: string,
  imageIndex: number,
  extension: string,
  usedFileNames: Set<string>,
): string {
  const imageSerial = String(imageIndex + 1).padStart(2, '0')
  const baseName = `${exportId}-${imageSerial}`
  let fileName = `${baseName}.${extension}`
  let dedupeIndex = 2
  while (usedFileNames.has(fileName)) {
    fileName = `${baseName}-${dedupeIndex}.${extension}`
    dedupeIndex += 1
  }
  usedFileNames.add(fileName)
  return fileName
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

export async function exportGalleryImagesZip(
  tasks: TaskRecord[],
  onProgress?: (done: number, total: number) => void,
): Promise<GalleryImageExportResult> {
  const exportedAt = Date.now()
  const exportId = `img-${exportedAt.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const totalImages = countTaskOutputImages(tasks)
  const usedFileNames = new Set<string>()
  let exportedImageCount = 0
  let failedImageCount = 0
  let skippedTaskCount = 0

  // 流式打包（fflate Zip）：逐张喂入，内存峰值 ≈ 单张图片；
  // level 0（仅存储不压缩）——图片本身已是压缩格式，STORE 模式快得多且不阻塞主线程
  const outputChunks: Uint8Array[] = []
  let zipError: Error | null = null
  const zip = new Zip((error, data) => {
    if (error) {
      zipError = error
      return
    }
    outputChunks.push(data)
  })

  const addZipEntry = (filePath: string, bytes: Uint8Array) => {
    const stream = new ZipDeflate(filePath, { level: 0 })
    zip.add(stream)
    stream.push(bytes, true)
  }

  for (let taskIndex = 0; taskIndex < tasks.length; taskIndex += 1) {
    const task = tasks[taskIndex]
    if (!task.outputImages.length) {
      skippedTaskCount += 1
      continue
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
        const filePath = buildFlatImageFileName(exportId, exportedImageCount, extension, usedFileNames)
        const bytes = await blobToBytes(blob)
        addZipEntry(filePath, bytes)
        exportedImageCount += 1
        onProgress?.(exportedImageCount, totalImages)
      } catch (error) {
        console.warn('[gallery-export] image export failed', {
          taskId: task.id,
          imageId,
          imageIndex,
          error: buildFailureMessage(error),
        })
        failedImageCount += 1
        onProgress?.(exportedImageCount + failedImageCount, totalImages)
      }
    }
  }

  if (!exportedImageCount && !failedImageCount) {
    return {
      exportedImageCount,
      failedImageCount,
      skippedTaskCount,
      taskCount: tasks.length,
    }
  }

  zip.end()
  if (zipError) {
    throw zipError
  }

  const blob = new Blob(outputChunks as BlobPart[], { type: 'application/zip' })
  downloadZip(blob, `gallery-images-${new Date(exportedAt).toISOString().slice(0, 10)}-${exportedAt}.zip`)

  return {
    exportedImageCount,
    failedImageCount,
    skippedTaskCount,
    taskCount: tasks.length,
  }
}
