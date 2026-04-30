import type { AppliedTransportMeta, AppSettings, TaskResponseMeta } from '../../types'
import { getResponsesTransportMode } from './config'
import type {
  ActualTransportKind,
  ApiError,
  ImagesRequestPlan,
  ResponsesActionMode,
  ResponsesInputImage,
  ResponsesInputPayloadMode,
  ResponsesRequestPlan,
  ResponsesToolChoiceMode,
  ResponsesTransportKind,
} from './types'

interface PlannerSession<TPlan extends { transport: ResponsesTransportKind }> {
  currentPlan: TPlan
  completeSuccess: (actualTransport: ActualTransportKind) => AppliedTransportMeta
  failAndAdvance: (error: unknown) => TPlan | null
}

function isAbortLikeError(error: unknown): error is Error {
  return error instanceof Error && (error.name === 'AbortError' || /\babort(?:ed)?\b/i.test(error.message))
}

function isAuthLikeError(error: unknown): error is Error {
  return error instanceof Error && /(?:auth_not_found|no auth available|invalid api key|insufficient|quota)/i.test(error.message)
}

function shouldBlockTransportFallback(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return true
  }

  if (isAbortLikeError(error) || isAuthLikeError(error)) {
    return true
  }

  const status = (error as ApiError).status
  return status != null && [401, 403, 429, 524].includes(status)
}

function buildTransportMeta(
  requested: AppliedTransportMeta['requested'],
  actual: NonNullable<AppliedTransportMeta['actual']>,
  fallbackFromStream: boolean,
): AppliedTransportMeta {
  return {
    requested,
    actual,
    fallbackFromStream,
  }
}

export function mergeTaskResponseTransportMeta(
  baseMeta: TaskResponseMeta | undefined,
  transportMeta: AppliedTransportMeta,
): TaskResponseMeta {
  return {
    ...(baseMeta ?? {}),
    transport: transportMeta,
  }
}

function getPreferredTransportSequence(settings: AppSettings): ResponsesTransportKind[] {
  const mode = getResponsesTransportMode(settings)
  if (mode === 'json') {
    return ['json']
  }

  return ['stream', 'json']
}

function shouldFallbackResponsesStreamToJson(
  error: unknown,
  currentPlan: { transport: ResponsesTransportKind },
  nextPlan?: { transport: ResponsesTransportKind },
): boolean {
  if (currentPlan.transport !== 'stream' || nextPlan?.transport !== 'json') {
    return false
  }

  return !shouldBlockTransportFallback(error)
}

function shouldRetryResponsesWithCompatibility(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  if (isResponsesRelayFailure(error)) {
    return false
  }

  const status = (error as ApiError).status
  if (status != null && [404, 405, 409, 415, 422, 500, 501].includes(status)) {
    return true
  }

  return /(?:HTTP 5\d{2}|tool(?:_choice)?|image_generation|response|internal|server error|input must be a list|input.*array|expected.*list|expected.*array|multipart|stream|sse|file_id|unknown parameter|invalid_request_error)/i.test(
    error.message,
  )
}

function shouldRetryImagesPlan(
  error: unknown,
  currentPlan: ImagesRequestPlan,
  nextPlan?: ImagesRequestPlan,
): boolean {
  if (!nextPlan || !(error instanceof Error)) {
    return false
  }

  if (currentPlan.transport === 'stream' && nextPlan.transport === 'json') {
    return !shouldBlockTransportFallback(error)
  }

  if (shouldBlockTransportFallback(error)) {
    return false
  }

  const status = (error as ApiError).status

  if (currentPlan.bodyMode === 'json' && nextPlan.bodyMode === 'multipart') {
    if (status != null && (status >= 500 || [400, 404, 405, 415, 422, 501].includes(status))) {
      return true
    }

    return /(?:接口未返回可用图片数据|no usable image|invalid_request|unsupported|not implemented|multipart|form|image\[\]|images\b)/i.test(
      error.message,
    )
  }

  if (currentPlan.transport !== 'json' || nextPlan.transport !== 'stream') {
    return false
  }

  if (status != null && (status >= 500 || [404, 405, 501].includes(status))) {
    return true
  }

  return /(?:接口未返回可用图片数据|no usable image|bad_response_body|unsupported|not implemented|stream|sse|server error|internal)/i.test(
    error.message,
  )
}

function isResponsesRelayFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const status = (error as ApiError).status
  if (status === 524) {
    return true
  }

  return /(?:do_request_failed|upstream error|cloudflare|timeout occurred|timed out|auth_not_found|no auth available)/i.test(
    error.message,
  )
}

function buildResponsesRequestPlans(
  opts: CallApiOptions,
  inputImages: ResponsesInputImage[],
): ResponsesRequestPlan[] {
  const hasReferenceImages = inputImages.length > 0
  const hasEditMask = Boolean(opts.editMaskDataUrl)
  const defaultInputPayloadMode: ResponsesInputPayloadMode = 'message-list'
  const transports = getPreferredTransportSequence(opts.settings)
  const primaryTransports: ResponsesTransportKind[] =
    hasEditMask && getResponsesTransportMode(opts.settings) === 'auto'
      ? ['json', 'stream']
      : transports
  const allowJsonCompatibilityFallback = getResponsesTransportMode(opts.settings) === 'auto'
  const compatibilityTransports: ResponsesTransportKind[] = allowJsonCompatibilityFallback ? ['json'] : transports
  const plans: ResponsesRequestPlan[] = []

  const pushPlan = (plan: ResponsesRequestPlan) => {
    if (!plans.some((item) => item.id === plan.id)) {
      plans.push(plan)
    }
  }

  for (const transport of primaryTransports) {
    pushPlan({
      id: `official-${transport}-${defaultInputPayloadMode}`,
      inputPayloadMode: defaultInputPayloadMode,
      transport,
      actionMode: hasEditMask ? 'explicit' : 'auto',
      toolChoiceMode: hasEditMask ? 'force' : 'omit',
    })
  }

  if (hasReferenceImages && !hasEditMask) {
    for (const transport of compatibilityTransports) {
      pushPlan({
        id: `explicit-action-${transport}`,
        inputPayloadMode: 'message-list',
        transport,
        actionMode: 'explicit',
        toolChoiceMode: 'omit',
      })
    }
  }

  if (!hasReferenceImages && defaultInputPayloadMode !== 'message-list') {
    for (const transport of compatibilityTransports) {
      pushPlan({
        id: `message-list-${transport}`,
        inputPayloadMode: 'message-list',
        transport,
        actionMode: 'auto',
        toolChoiceMode: 'omit',
      })
    }
  }

  if (!hasEditMask) {
    const forcedToolInputPayloadMode: ResponsesInputPayloadMode =
      !hasReferenceImages && defaultInputPayloadMode !== 'message-list'
        ? 'message-list'
        : defaultInputPayloadMode
    const forcedToolActionMode: ResponsesActionMode =
      hasReferenceImages || forcedToolInputPayloadMode === 'message-list' ? 'explicit' : 'auto'
    const forcedToolChoiceMode: ResponsesToolChoiceMode = 'force'

    for (const transport of compatibilityTransports) {
      pushPlan({
        id: `forced-tool-${transport}-${forcedToolInputPayloadMode}`,
        inputPayloadMode: forcedToolInputPayloadMode,
        transport,
        actionMode: forcedToolActionMode,
        toolChoiceMode: forcedToolChoiceMode,
      })
    }
  }

  return plans
}

function buildImagesRequestPlans(settings: AppSettings, options?: { isEdit?: boolean }): ImagesRequestPlan[] {
  const transports = getPreferredTransportSequence(settings)

  if (!options?.isEdit) {
    return transports.map((transport) => ({
      id: transport,
      transport,
      bodyMode: 'json',
    }))
  }

  const plans: ImagesRequestPlan[] = []
  for (const transport of transports) {
    plans.push(
      {
        id: `json-body-${transport}`,
        transport,
        bodyMode: 'json',
      },
      {
        id: `multipart-body-${transport}`,
        transport,
        bodyMode: 'multipart',
      },
    )
  }

  return plans
}

function createPlannerSession<TPlan extends { transport: ResponsesTransportKind }>(
  requested: AppliedTransportMeta['requested'],
  plans: TPlan[],
  shouldAdvance: (error: unknown, currentPlan: TPlan, nextPlan?: TPlan) => boolean,
): PlannerSession<TPlan> {
  let planIndex = 0
  let hasAttemptedStream = false

  return {
    get currentPlan() {
      return plans[planIndex]
    },
    completeSuccess(actualTransport: ActualTransportKind) {
      const fallbackFromStream = actualTransport === 'json' && hasAttemptedStream
      return buildTransportMeta(requested, actualTransport, fallbackFromStream)
    },
    failAndAdvance(error: unknown) {
      const currentPlan = plans[planIndex]
      const nextPlan = plans[planIndex + 1]
      if (currentPlan.transport === 'stream') {
        hasAttemptedStream = true
      }
      if (!shouldAdvance(error, currentPlan, nextPlan)) {
        return null
      }

      planIndex += 1
      return plans[planIndex] ?? null
    },
  }
}

export function createResponsesPlanner(
  opts: CallApiOptions,
  inputImages: ResponsesInputImage[],
): PlannerSession<ResponsesRequestPlan> {
  const requested = getResponsesTransportMode(opts.settings)
  return createPlannerSession(
    requested,
    buildResponsesRequestPlans(opts, inputImages),
    (error, currentPlan, nextPlan) =>
      shouldRetryResponsesWithCompatibility(error) ||
      shouldFallbackResponsesStreamToJson(error, currentPlan, nextPlan),
  )
}

export function createImagesPlanner(
  settings: AppSettings,
  options?: { isEdit?: boolean },
): PlannerSession<ImagesRequestPlan> {
  const requested = getResponsesTransportMode(settings)
  return createPlannerSession(requested, buildImagesRequestPlans(settings, options), shouldRetryImagesPlan)
}
