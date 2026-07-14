import type { Prisma } from '@prisma/client'

interface UploadedGeneratedAsset {
  imageIndex: number
  r2Key?: string | null
  publicUrl: string
  mimeType: string
  byteSize: number
  width?: number | null
  height?: number | null
}

interface PersistGeneratedAssetsInput {
  taskId: string
  userId: string
  uploadMode?: string | null
  assets?: UploadedGeneratedAsset[]
}

function isPersistableAsset(asset: UploadedGeneratedAsset): boolean {
  return /^https?:\/\//i.test(asset.publicUrl)
}

export async function replaceGeneratedAssetsForTask(
  tx: Prisma.TransactionClient,
  input: PersistGeneratedAssetsInput,
): Promise<void> {
  await tx.generatedAsset.deleteMany({
    where: { taskId: input.taskId },
  })

  const assets = input.assets?.filter(isPersistableAsset) ?? []
  if (!assets.length) return

  await tx.generatedAsset.createMany({
    data: assets.map((asset) => ({
      taskId: input.taskId,
      userId: input.userId,
      imageIndex: asset.imageIndex,
      r2Key: asset.r2Key || null,
      publicUrl: asset.publicUrl,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      width: asset.width ?? null,
      height: asset.height ?? null,
      uploadMode: input.uploadMode || null,
    })),
  })
}
