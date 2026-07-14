import { HttpError } from './http.js'
import type { PlatformSettings } from './settings.js'

interface ConsumeSub2ApiRedeemCodeInput {
  code: string
  settings: Pick<PlatformSettings, 'sub2apiRedeemEnabled' | 'sub2apiRedeemBaseUrl' | 'sub2apiRedeemToken'>
  userId: string
  email: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readNumber(value: unknown): number | undefined {
  const next = Number(value)
  return Number.isFinite(next) ? next : undefined
}

function readNestedRecord(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    return {}
  }
  const data = payload.data
  return isRecord(data) ? { ...payload, ...data } : payload
}

function unwrapSub2ApiData(payload: unknown): unknown {
  if (!isRecord(payload) || !('data' in payload)) {
    return payload
  }
  return payload.data
}

function readItems(payload: unknown): Array<Record<string, unknown>> {
  const data = unwrapSub2ApiData(payload)
  if (isRecord(data) && Array.isArray(data.items)) {
    return data.items.filter(isRecord)
  }
  if (Array.isArray(data)) {
    return data.filter(isRecord)
  }
  return []
}

function normalizeSub2ApiApiBase(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (/\/api\/v1$/i.test(trimmed)) return trimmed
  return `${trimmed}/api/v1`
}

function buildQuery(params: Record<string, string | number>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value))
  }
  return search.toString()
}

function assertSub2ApiSuccess(payload: unknown, fallback: string) {
  if (!isRecord(payload)) return
  const envelopeCode = payload.code
  if (typeof envelopeCode === 'number' && envelopeCode !== 0) {
    throw new HttpError(502, 'SUB2API_REDEEM_CHECK_FAILED', formatSub2ApiMessage(payload, fallback))
  }
  const success = payload.success
  if (typeof success === 'boolean' && !success) {
    throw new HttpError(502, 'SUB2API_REDEEM_CHECK_FAILED', formatSub2ApiMessage(payload, fallback))
  }
}

function assertSub2ApiRedeemCodeUsable(record: Record<string, unknown>) {
  const status = readString(record.status).toLowerCase()
  if (status === 'used' || record.used_at || record.used_by) {
    throw new HttpError(409, 'SUB2API_REDEEM_CODE_USED', '兑换码已使用')
  }
  if (status && status !== 'unused') {
    throw new HttpError(409, 'SUB2API_REDEEM_CODE_UNAVAILABLE', `sub2api 兑换码当前不可用：${status}`)
  }
}

function formatSub2ApiMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) {
    return fallback
  }
  const record = readNestedRecord(payload)
  return readString(record.message)
    || readString(record.error)
    || readString(record.reason)
    || readString(record.detail)
    || fallback
}

async function requestSub2ApiJson(apiBase: string, token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { 'x-api-key': token } : {}),
      ...(init.headers ?? {}),
    },
  })
  const text = await response.text().catch(() => '')
  const payload = text ? JSON.parse(text) as unknown : null
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(502, 'SUB2API_ADMIN_KEY_INVALID', 'sub2api Admin API Key 无效或权限不足')
    }
    throw new HttpError(
      502,
      'SUB2API_REDEEM_CHECK_FAILED',
      formatSub2ApiMessage(payload, `sub2api 请求失败：HTTP ${response.status}`),
    )
  }
  assertSub2ApiSuccess(payload, 'sub2api 请求失败')
  return payload
}

async function findSub2ApiRedeemCode(apiBase: string, token: string, code: string) {
  const query = buildQuery({
    search: code,
    page: 1,
    page_size: 10,
  })
  const payload = await requestSub2ApiJson(apiBase, token, `/admin/redeem-codes?${query}`)
  const normalizedCode = code.toLowerCase()
  const record = readItems(payload).find((item) => readString(item.code).toLowerCase() === normalizedCode)
  if (!record) {
    throw new HttpError(404, 'SUB2API_REDEEM_CODE_NOT_FOUND', 'sub2api 兑换码不存在')
  }
  return record
}

async function getSub2ApiRedeemUserId(apiBase: string, token: string) {
  const query = buildQuery({
    role: 'admin',
    page: 1,
    page_size: 1,
  })
  const payload = await requestSub2ApiJson(apiBase, token, `/admin/users?${query}`)
  const first = readItems(payload)[0]
  const id = first ? readNumber(first.id) : undefined
  if (!id || id <= 0) {
    throw new HttpError(502, 'SUB2API_ADMIN_USER_NOT_FOUND', 'sub2api 未找到可用于核销兑换码的管理员用户')
  }
  return id
}

export async function consumeSub2ApiRedeemCode(input: ConsumeSub2ApiRedeemCodeInput) {
  const apiBase = normalizeSub2ApiApiBase(input.settings.sub2apiRedeemBaseUrl)
  if (!input.settings.sub2apiRedeemEnabled || !apiBase) {
    return
  }
  if (!input.settings.sub2apiRedeemToken.trim()) {
    throw new HttpError(400, 'SUB2API_ADMIN_KEY_REQUIRED', '请先配置 sub2api Admin API Key')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const token = input.settings.sub2apiRedeemToken.trim()
    const before = await findSub2ApiRedeemCode(apiBase, token, input.code)
    assertSub2ApiRedeemCodeUsable(before)

    const redeemUserId = await getSub2ApiRedeemUserId(apiBase, token)
    const canonicalCode = readString(before.code) || input.code
    const type = readString(before.type) || 'balance'
    const value = readNumber(before.value) || 1
    const groupId = readNumber(before.group_id)
    const validityDays = readNumber(before.validity_days) || undefined
    await requestSub2ApiJson(apiBase, token, '/admin/redeem-codes/create-and-redeem', {
      method: 'POST',
      body: JSON.stringify({
        code: canonicalCode,
        type,
        value,
        user_id: redeemUserId,
        ...(groupId ? { group_id: groupId } : {}),
        ...(validityDays ? { validity_days: validityDays } : {}),
        notes: `gpt-image-playground sync: user=${input.userId}, email=${input.email}`,
      }),
      signal: controller.signal,
    })

    const after = await findSub2ApiRedeemCode(apiBase, token, input.code)
    const afterStatus = readString(after.status).toLowerCase()
    if (afterStatus !== 'used' || !after.used_at) {
      throw new HttpError(502, 'SUB2API_REDEEM_CONFIRM_FAILED', 'sub2api 兑换码核销后确认状态失败')
    }
    return {
      id: readNumber(after.id),
      status: afterStatus,
      usedBy: readNumber(after.used_by),
      usedAt: readString(after.used_at),
    }
  } catch (error) {
    if (error instanceof HttpError) {
      throw error
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpError(504, 'SUB2API_REDEEM_CHECK_TIMEOUT', 'sub2api 兑换码校验超时，请稍后重试')
    }
    throw new HttpError(
      502,
      'SUB2API_REDEEM_CHECK_FAILED',
      error instanceof Error ? error.message : 'sub2api 兑换码校验失败',
    )
  } finally {
    clearTimeout(timer)
  }
}
