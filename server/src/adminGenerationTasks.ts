import type { Prisma } from '@prisma/client'

const ADMIN_PREVIEW_LIMIT = 4

export const adminGenerationTaskSelect = {
  id: true,
  userId: true,
  modelConfigId: true,
  prompt: true,
  params: true,
  status: true,
  costCredits: true,
  outputPreviews: true,
  error: true,
  createdAt: true,
  finishedAt: true,
  user: { select: { email: true } },
  modelConfig: { select: { displayName: true, name: true } },
  generatedAssets: {
    orderBy: { imageIndex: 'asc' },
    select: {
      id: true,
      taskId: true,
      userId: true,
      imageIndex: true,
      r2Key: true,
      publicUrl: true,
      mimeType: true,
      byteSize: true,
      width: true,
      height: true,
      uploadMode: true,
      source: true,
      createdAt: true,
    },
  },
} satisfies Prisma.GenerationTaskSelect

export type AdminGenerationTaskRecord = Prisma.GenerationTaskGetPayload<{
  select: typeof adminGenerationTaskSelect
}>

function summarizeOutputPreviews(value: Prisma.JsonValue | null): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []

  return value.map((item, fallbackIndex) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { index: fallbackIndex, status: 'unknown' }
    }

    const image = item as Record<string, unknown>
    const index = typeof image.index === 'number' ? image.index : fallbackIndex
    const storedPreview = typeof image.previewDataUrl === 'string' ? image.previewDataUrl : ''
    const previewDataUrl = index < ADMIN_PREVIEW_LIMIT && /^data:image\/webp;base64,/i.test(storedPreview)
      ? storedPreview
      : null

    return {
      index,
      status: typeof image.status === 'string' ? image.status : previewDataUrl ? 'done' : 'unknown',
      mimeType: typeof image.mimeType === 'string' ? image.mimeType : undefined,
      error: typeof image.error === 'string' ? image.error : undefined,
      previewDataUrl: previewDataUrl || undefined,
    }
  })
}

export function toAdminGenerationTask(record: AdminGenerationTaskRecord) {
  const { outputPreviews, ...task } = record
  return {
    ...task,
    outputImages: summarizeOutputPreviews(outputPreviews),
  }
}

export function toAdminGenerationTasks(records: AdminGenerationTaskRecord[]) {
  return records.map(toAdminGenerationTask)
}
