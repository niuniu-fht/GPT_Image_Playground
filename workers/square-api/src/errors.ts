export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export function badRequest(message: string): ApiError {
  return new ApiError('bad_request', message, 400)
}

export function unauthorized(message = '请先创建或携带广场发布者身份'): ApiError {
  return new ApiError('unauthorized', message, 401)
}

export function forbidden(message: string): ApiError {
  return new ApiError('forbidden', message, 403)
}

export function notFound(message = '资源不存在'): ApiError {
  return new ApiError('not_found', message, 404)
}

export function payloadTooLarge(message: string): ApiError {
  return new ApiError('payload_too_large', message, 413)
}

export function unsupportedMediaType(message: string): ApiError {
  return new ApiError('unsupported_media_type', message, 415)
}

export function quotaExceeded(message: string): ApiError {
  return new ApiError('quota_exceeded', message, 429)
}

export function rateLimited(message = '请求过于频繁，请稍后再试'): ApiError {
  return new ApiError('rate_limited', message, 429)
}

export function validationFailed(message: string): ApiError {
  return new ApiError('validation_failed', message, 422)
}

export function internalError(message = '服务暂时不可用'): ApiError {
  return new ApiError('internal_error', message, 500)
}
