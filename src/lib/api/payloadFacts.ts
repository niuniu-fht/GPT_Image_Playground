import { isRecord } from '../guards'
import { isDataUrl, isHttpUrl } from './imageTransforms'

export interface ResponseImageGenerationCallMeta {
  id?: string
  status?: string
  size?: string
  quality?: string
  output_format?: string
  background?: string
  action?: string
  revised_prompt?: string
}

type ReadStringField = (fieldName: string) => string | undefined
type ReadNumberField = (fieldName: string) => number | undefined

const RESPONSE_OUTPUT_ITEM_STRING_FIELDS = [
  'id',
  'type',
  'status',
  'size',
  'quality',
  'output_format',
  'background',
  'action',
  'revised_prompt',
  'url',
  'image_url',
] as const

const RESPONSE_OUTPUT_ITEM_NUMBER_FIELDS = ['output_index'] as const
const COMPACT_RESPONSES_STRING_FIELDS = ['id', 'object', 'status', 'model'] as const
const COMPACT_RESPONSES_NUMBER_FIELDS = ['created_at'] as const
const IMAGE_PAYLOAD_DEBUG_STRING_FIELDS = [
  'type',
  'id',
  'status',
  'size',
  'quality',
  'output_format',
  'background',
  'action',
  'revised_prompt',
  'b64_json',
  'result',
  'url',
  'image_url',
] as const
const IMAGE_GENERATION_CALL_META_STRING_FIELDS = [
  'id',
  'status',
  'size',
  'quality',
  'output_format',
  'background',
  'action',
  'revised_prompt',
] as const

export function readOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function copyOptionalStringFields(
  target: Record<string, unknown>,
  readString: ReadStringField,
  fieldNames: readonly string[],
): void {
  for (const fieldName of fieldNames) {
    const value = readString(fieldName)
    if (value) {
      target[fieldName] = value
    }
  }
}

function copyOptionalNumberFields(
  target: Record<string, unknown>,
  readNumber: ReadNumberField,
  fieldNames: readonly string[],
): void {
  for (const fieldName of fieldNames) {
    const value = readNumber(fieldName)
    if (typeof value === 'number' && Number.isFinite(value)) {
      target[fieldName] = value
    }
  }
}

function readStringFieldFromRecord(
  record: Record<string, unknown>,
  fieldName: string,
): string | undefined {
  return readOptionalText(record[fieldName]) ?? undefined
}

function readNumberFieldFromRecord(
  record: Record<string, unknown>,
  fieldName: string,
): number | undefined {
  const value = record[fieldName]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function hasUsableImagePayload(item: Record<string, unknown>): boolean {
  return (
    readOptionalText(item.b64_json) != null ||
    readOptionalText(item.result) != null ||
    readOptionalText(item.url) != null ||
    readOptionalText(item.image_url) != null
  )
}

export function hasDirectImagePayload(payload: Record<string, unknown>): boolean {
  const b64 = readOptionalText(payload.b64_json)
  if (b64) {
    return true
  }

  const result = readOptionalText(payload.result)
  if (result) {
    return true
  }

  const url = readOptionalText(payload.url)
  if (url && (isDataUrl(url) || isHttpUrl(url))) {
    return true
  }

  const imageUrl = readOptionalText(payload.image_url)
  if (imageUrl && (isDataUrl(imageUrl) || isHttpUrl(imageUrl))) {
    return true
  }

  return false
}

export function isPartialImagePayloadType(type: unknown): boolean {
  return typeof type === 'string' && type.includes('partial_image')
}

export function isImagesFailurePayload(payload: Record<string, unknown>): boolean {
  const type = readOptionalText(payload.type)
  if (type && /(?:^error$|failed$)/i.test(type)) {
    return true
  }

  return isRecord(payload.error)
}

export function isCompletedImagesPayload(payload: Record<string, unknown>): boolean {
  const type = readOptionalText(payload.type)
  if (!type || isPartialImagePayloadType(type) || !hasDirectImagePayload(payload)) {
    return false
  }

  if (/^image_(?:generation|edit)\.completed$/i.test(type)) {
    return true
  }

  return /\.completed$/i.test(type)
}

export function buildCompactResponsesMetaFromFieldReaders(
  readString: ReadStringField,
  readNumber: ReadNumberField,
): Record<string, unknown> {
  const compact: Record<string, unknown> = {}
  copyOptionalStringFields(compact, readString, COMPACT_RESPONSES_STRING_FIELDS)
  copyOptionalNumberFields(compact, readNumber, COMPACT_RESPONSES_NUMBER_FIELDS)
  return compact
}

export function buildCompactResponsesPayload(
  response: Record<string, unknown>,
  outputOverride?: unknown[],
): Record<string, unknown> {
  const compact = buildCompactResponsesMetaFromFieldReaders(
    (fieldName) => readStringFieldFromRecord(response, fieldName),
    (fieldName) => readNumberFieldFromRecord(response, fieldName),
  )

  if (isRecord(response.error)) {
    compact.error = response.error
  }

  const output = outputOverride ?? (Array.isArray(response.output) ? response.output : [])
  if (output.length > 0) {
    compact.output = output
  }

  return Object.keys(compact).length > 0 ? compact : { output }
}

export function buildResponsesOutputItemFromFieldReaders(
  readString: ReadStringField,
  readNumber: ReadNumberField,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  copyOptionalStringFields(sanitized, readString, RESPONSE_OUTPUT_ITEM_STRING_FIELDS)
  copyOptionalNumberFields(sanitized, readNumber, RESPONSE_OUTPUT_ITEM_NUMBER_FIELDS)

  return Object.keys(sanitized).length > 0 ? sanitized : { type: 'image_generation_call' }
}

export function sanitizeResponsesOutputItem(
  item: Record<string, unknown>,
): Record<string, unknown> {
  return buildResponsesOutputItemFromFieldReaders(
    (fieldName) => readStringFieldFromRecord(item, fieldName),
    (fieldName) => readNumberFieldFromRecord(item, fieldName),
  )
}

export function extractImageGenerationCallMeta(
  item: Record<string, unknown>,
): ResponseImageGenerationCallMeta | null {
  if (item.type !== 'image_generation_call') {
    return null
  }

  const call: ResponseImageGenerationCallMeta = {}
  for (const fieldName of IMAGE_GENERATION_CALL_META_STRING_FIELDS) {
    const value = readOptionalText(item[fieldName])
    if (value) {
      call[fieldName] = value
    }
  }

  return Object.keys(call).length > 0 ? call : {}
}

export function collectDebugImagePayloadFields(
  item: Record<string, unknown>,
): Record<string, string> {
  const compact: Record<string, string> = {}
  for (const fieldName of IMAGE_PAYLOAD_DEBUG_STRING_FIELDS) {
    const value = readOptionalText(item[fieldName])
    if (value) {
      compact[fieldName] = value
    }
  }
  return compact
}
