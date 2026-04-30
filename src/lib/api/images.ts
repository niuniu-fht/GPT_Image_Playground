import {
  buildApiErrorFromResponse,
  buildAppliedTransportMeta,
  buildImagesRequestPlans,
  buildRequestUrl,
  createApiError,
  createDebugRequestLogEntry,
  dataUrlToBlob,
  emitFinalImages,
  getResponsesTransportMode,
  isDataUrl,
  isSseResponse,
  isHttpUrl,
  mergeTaskResponseMeta,
  parseImagesFromPayload,
  readDevProxyRequestId,
  readImagesPayload,
  readImagesPayloadStream,
  sanitizeDebugValue,
  shouldRetryNextImagesPlan,
} from './helpers'
import type {
  ApiImageAsset,
  ApiDebugRequestLogEntry,
  CallApiOptions,
  CallApiResult,
  SharedRequestContext,
} from './types'

export async function callImagesApi(
  opts: CallApiOptions,
  ctx: SharedRequestContext,
): Promise<CallApiResult> {
  const { settings, prompt, params, inputImageDataUrls, editMaskDataUrl } = opts
  const isEdit = inputImageDataUrls.length > 0
  const requestPlans = buildImagesRequestPlans(settings, { isEdit })
  let lastError: unknown = null

  for (let planIndex = 0; planIndex < requestPlans.length; planIndex += 1) {
    const plan = requestPlans[planIndex]
    const nextPlan = requestPlans[planIndex + 1]
    let debugLogEntry: ApiDebugRequestLogEntry | undefined

    try {
      let response: Response
      let actualTransport: 'json' | 'stream' = 'json'

      if (isEdit) {
        const requestUrl = buildRequestUrl(settings.baseUrl, 'images/edits', ctx)
        if (plan.bodyMode === 'json') {
          const images = inputImageDataUrls.map((value) => {
            if (!isDataUrl(value) && !isHttpUrl(value)) {
              throw createApiError('编辑参考图格式不受支持，请使用本地图片或公网图片 URL')
            }
            return { image_url: value }
          })

          const body: Record<string, unknown> = {
            model: settings.model,
            prompt,
            images,
            size: params.size,
            quality: params.quality,
            output_format: params.output_format,
            moderation: params.moderation,
          }

          if (params.n > 1) {
            body.n = params.n
          }
          if (params.output_format !== 'png' && params.output_compression != null) {
            body.output_compression = params.output_compression
          }
          if (editMaskDataUrl) {
            if (!isDataUrl(editMaskDataUrl) && !isHttpUrl(editMaskDataUrl)) {
              throw createApiError('编辑蒙版格式不受支持，请使用本地图片或公网图片 URL')
            }
            body.mask = {
              image_url: editMaskDataUrl,
            }
          }
          if (plan.transport === 'stream') {
            body.stream = true
          }

          debugLogEntry = createDebugRequestLogEntry(ctx, `images.edit.${plan.id}`, 'POST', requestUrl, {
            ...body,
            imageCount: inputImageDataUrls.length,
            hasMask: Boolean(editMaskDataUrl),
            bodyMode: plan.bodyMode,
          })

          response = await fetch(requestUrl, {
            method: 'POST',
            headers: {
              ...ctx.requestHeaders,
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
            body: JSON.stringify(body),
            signal: ctx.controller.signal,
          })
        } else {
          const formData = new FormData()
          formData.append('model', settings.model)
          formData.append('prompt', prompt)
          formData.append('size', params.size)
          formData.append('quality', params.quality)
          formData.append('output_format', params.output_format)
          formData.append('moderation', params.moderation)
          if (params.n > 1) {
            formData.append('n', String(params.n))
          }

          if (params.output_format !== 'png' && params.output_compression != null) {
            formData.append('output_compression', String(params.output_compression))
          }
          if (plan.transport === 'stream') {
            formData.append('stream', 'true')
          }

          for (let index = 0; index < inputImageDataUrls.length; index += 1) {
            const dataUrl = inputImageDataUrls[index]
            const blob = await dataUrlToBlob(dataUrl)
            const ext = blob.type.split('/')[1] || 'png'
            formData.append('image[]', blob, `input-${index + 1}.${ext}`)
          }
          if (editMaskDataUrl) {
            const maskBlob = await dataUrlToBlob(editMaskDataUrl)
            formData.append('mask', maskBlob, 'mask.png')
          }

          debugLogEntry = createDebugRequestLogEntry(ctx, `images.edit.${plan.id}`, 'POST', requestUrl, {
            model: settings.model,
            prompt,
            size: params.size,
            quality: params.quality,
            output_format: params.output_format,
            moderation: params.moderation,
            n: params.n > 1 ? params.n : undefined,
            output_compression: params.output_format !== 'png' ? params.output_compression : undefined,
            imageCount: inputImageDataUrls.length,
            hasMask: Boolean(editMaskDataUrl),
            stream: plan.transport === 'stream',
            bodyMode: plan.bodyMode,
          })

          response = await fetch(requestUrl, {
            method: 'POST',
            headers: ctx.requestHeaders,
            cache: 'no-store',
            body: formData,
            signal: ctx.controller.signal,
          })
        }
      } else {
        const body: Record<string, unknown> = {
          model: settings.model,
          prompt,
          size: params.size,
          quality: params.quality,
          output_format: params.output_format,
          moderation: params.moderation,
        }

        if (params.output_format !== 'png' && params.output_compression != null) {
          body.output_compression = params.output_compression
        }
        if (params.n > 1) {
          body.n = params.n
        }
        if (plan.transport === 'stream') {
          body.stream = true
        }

        const requestUrl = buildRequestUrl(settings.baseUrl, 'images/generations', ctx)
        debugLogEntry = createDebugRequestLogEntry(ctx, `images.generate.${plan.id}`, 'POST', requestUrl, body)

        response = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            ...ctx.requestHeaders,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
          body: JSON.stringify(body),
          signal: ctx.controller.signal,
        })
      }

      if (!response.ok) {
        throw await buildApiErrorFromResponse(response, debugLogEntry)
      }

      const requestId = readDevProxyRequestId(response.headers)
      const shouldReadAsStream = plan.transport === 'stream' || isSseResponse(response)
      const streamResult =
        shouldReadAsStream
          ? await readImagesPayloadStream(
              response,
              ctx.mime,
              ctx.controller.signal,
              debugLogEntry,
            )
          : null
      const payload = streamResult?.payload ?? (await readImagesPayload(response, debugLogEntry))
      const streamedImages = streamResult?.streamedImages ?? []
      actualTransport = streamResult?.actualTransport ?? 'json'
      const images: ApiImageAsset[] =
        actualTransport === 'stream' && streamedImages.length > 0
          ? streamedImages
          : await parseImagesFromPayload(payload, ctx.mime, ctx.controller.signal)
      if (!images.length) {
        if (debugLogEntry) {
          debugLogEntry.responseBody = sanitizeDebugValue(payload)
        }
        throw createApiError('接口未返回可用图片数据', response.status, {
          requestId,
          details: {
            responseBody: payload,
          },
        })
      }

      await emitFinalImages(opts, images)
      const fallbackFromStream =
        actualTransport === 'json' &&
        requestPlans.slice(0, planIndex).some((item) => item.transport === 'stream')
      return {
        images,
        responseMeta: mergeTaskResponseMeta(
          undefined,
          buildAppliedTransportMeta(
            getResponsesTransportMode(settings),
            actualTransport,
            fallbackFromStream,
          ),
        ),
      }
    } catch (error) {
      lastError = error
      const isLastPlan = planIndex === requestPlans.length - 1
      if (isLastPlan || !shouldRetryNextImagesPlan(error, plan, nextPlan)) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : createApiError('Images API 请求失败')
}
