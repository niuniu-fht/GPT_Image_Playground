import type { ApiInputImage, ApiImageAsset, CallApiResult } from '../lib/api'
import { platformApi } from '../lib/platformApi'
import type { AppSettings, TaskRecord } from '../types'
import { getImageView } from './imageAssets'
import { useStore } from './state'

export type TaskApiOutputImageAsset = ApiImageAsset

export interface TaskApiRequestHandlers {
  onFinalImages?: (images: TaskApiOutputImageAsset[]) => void | Promise<void>
  registerAbort?: (abort: () => void) => void
  throwIfAborted?: () => void
}

async function loadTaskInputImages(
  task: TaskRecord,
  throwIfAborted?: () => void,
) {
  const inputImages: ApiInputImage[] = []

  for (const imageId of task.inputImageIds) {
    throwIfAborted?.()
    const dataUrl = await getImageView(imageId).getRawDataUrl()
    throwIfAborted?.()
    if (!dataUrl) {
      continue
    }

    inputImages.push({
      id: imageId,
      dataUrl,
    })
  }

  return inputImages
}

async function loadTaskEditMaskDataUrl(
  task: TaskRecord,
  throwIfAborted?: () => void,
): Promise<string | undefined> {
  if (!task.editMaskImageId) {
    return undefined
  }

  throwIfAborted?.()
  const editMaskDataUrl = await getImageView(task.editMaskImageId).getRawDataUrl()
  throwIfAborted?.()
  if (!editMaskDataUrl) {
    throw new Error('局部编辑蒙版缺失，请重新选择编辑区域后再试')
  }

  return editMaskDataUrl
}

export async function callTaskImageApi(
  task: TaskRecord,
  _settings: AppSettings,
  handlers: TaskApiRequestHandlers = {},
): Promise<CallApiResult> {
  const inputImages = await loadTaskInputImages(
    task,
    handlers.throwIfAborted,
  )
  const editMaskDataUrl = await loadTaskEditMaskDataUrl(task, handlers.throwIfAborted)
  handlers.throwIfAborted?.()

  const result = await platformApi.generate({
    modelConfigId: task.modelConfigId || '',
    prompt: task.prompt,
    params: task.params,
    inputImages: inputImages.map((image) => ({
      id: image.id || 'input',
      dataUrl: image.dataUrl,
    })),
    editMask: editMaskDataUrl
      ? {
          dataUrl: editMaskDataUrl,
          sourceImageId: task.editSourceImageId ?? null,
          selection: task.editSelection ?? null,
        }
      : null,
  })

  const images: ApiImageAsset[] = await Promise.all(
    result.images.map(async (image) => {
      const response = await fetch(image.dataUrl)
      const blob = await response.blob()
      return {
        blob,
        mimeType: image.mimeType || blob.type || 'image/png',
      }
    }),
  )

  useStore.getState().setCurrentUser(result.user)
  await handlers.onFinalImages?.(images)

  return {
    images,
    responseMeta: (result.responseMeta as CallApiResult['responseMeta']) ?? undefined,
  }
}
