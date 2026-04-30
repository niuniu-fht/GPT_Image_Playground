import {
  buildApiErrorFromResponse,
  createDebugRequestLogEntry,
  isSseResponse,
  readDevProxyRequestId,
  sanitizeDebugValue,
} from './debug'
import { createApiError, emitFinalImages } from './imageTransforms'
import { parseImagesFromPayload } from './imagePayload'
import { readImagesPayload } from './payloadText'
import { createImagesPlanner, mergeTaskResponseTransportMeta } from './requestPlanner'
import { buildImagesRequestSpec } from './imagesRequestBuilder'
import { readImagesPayloadStream } from './helpers'
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
  const { settings, inputImageDataUrls } = opts
  const isEdit = inputImageDataUrls.length > 0
  const planner = createImagesPlanner(settings, { isEdit })

  while (true) {
    const plan = planner.currentPlan
    let debugLogEntry: ApiDebugRequestLogEntry | undefined

    try {
      let actualTransport: 'json' | 'stream' = 'json'
      const requestSpec = await buildImagesRequestSpec({ opts, plan, ctx })
      debugLogEntry = createDebugRequestLogEntry(
        ctx,
        requestSpec.stage,
        'POST',
        requestSpec.requestUrl,
        requestSpec.debugBody,
      )
      const response = await fetch(requestSpec.requestUrl, requestSpec.requestInit)

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
      return {
        images,
        responseMeta: mergeTaskResponseTransportMeta(
          undefined,
          planner.completeSuccess(actualTransport),
        ),
      }
    } catch (error) {
      if (!planner.failAndAdvance(error)) {
        throw error
      }
    }
  }
}
