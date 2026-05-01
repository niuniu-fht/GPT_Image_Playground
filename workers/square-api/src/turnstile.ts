import { getConfig } from './config'
import { forbidden, validationFailed } from './errors'
import { getClientIp } from './request'
import type { RequestContext } from './types'

interface TurnstileResponse {
  success?: boolean
  'error-codes'?: string[]
}

export async function validateTurnstileIfNeeded(ctx: RequestContext, token?: string): Promise<void> {
  const config = getConfig(ctx.env)
  if (!config.requireTurnstile) return

  if (!ctx.env.TURNSTILE_SECRET_KEY) {
    throw forbidden('服务端缺少 TURNSTILE_SECRET_KEY')
  }
  if (!token) {
    throw validationFailed('缺少 Turnstile 校验 token')
  }

  const form = new FormData()
  form.append('secret', ctx.env.TURNSTILE_SECRET_KEY)
  form.append('response', token)
  const ip = getClientIp(ctx.request)
  if (ip !== 'unknown') {
    form.append('remoteip', ip)
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  })
  const result = (await response.json()) as TurnstileResponse
  if (!result.success) {
    throw validationFailed(`Turnstile 校验失败：${result['error-codes']?.join(', ') || 'unknown'}`)
  }
}
