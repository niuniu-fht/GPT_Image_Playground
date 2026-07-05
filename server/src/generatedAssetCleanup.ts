import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { HttpError } from './http.js'
import { prisma } from './prisma.js'
import { getSquareRuntimeConfig, type SquareRuntimeConfig } from './squareConfig.js'

interface GeneratedAssetForCleanup {
  id: string
  taskId: string
  r2Key: string | null
}

export interface GeneratedAssetCleanupResult {
  assetRecords: number
  r2Objects: number
  skippedAssets: number
}

function createR2Client(config: SquareRuntimeConfig): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: config.r2Endpoint,
    credentials: {
      accessKeyId: config.r2AccessKey,
      secretAccessKey: config.r2SecretKey,
    },
  })
}

function validateR2CleanupConfig(config: SquareRuntimeConfig): void {
  if (!config.r2Enabled || !config.r2Endpoint || !config.r2AccessKey || !config.r2SecretKey || !config.r2Bucket) {
    throw new HttpError(
      409,
      'r2_cleanup_not_configured',
      '任务存在云端资产，但 R2 配置不完整，暂不能清理。请先在广场配置中测试 R2 后重试。',
    )
  }
}

function getCleanupErrorMessage(error: unknown): string {
  if (error instanceof HttpError) return error.message
  if (error instanceof Error) {
    if (/AccessDenied|Forbidden/i.test(error.message)) return 'R2 权限不足，无法删除云端资产'
    if (/NoSuchBucket|not exist/i.test(error.message)) return 'R2 Bucket 不存在或当前密钥无权访问'
    if (/ENOTFOUND|ECONNREFUSED|fetch failed/i.test(error.message)) return '无法连接 R2 Endpoint，云端资产未清理'
    return error.message
  }
  return String(error)
}

async function deleteR2Keys(keys: string[]): Promise<number> {
  if (!keys.length) return 0

  const config = await getSquareRuntimeConfig()
  validateR2CleanupConfig(config)
  const client = createR2Client(config)

  try {
    for (const key of keys) {
      await client.send(new DeleteObjectCommand({
        Bucket: config.r2Bucket,
        Key: key,
      }))
    }
  } catch (error) {
    console.warn('[generated-assets] r2 cleanup failed', error)
    throw new HttpError(502, 'r2_cleanup_failed', getCleanupErrorMessage(error))
  }

  return keys.length
}

function collectR2Keys(assets: GeneratedAssetForCleanup[]): string[] {
  return Array.from(
    new Set(
      assets
        .map((asset) => asset.r2Key?.trim())
        .filter((key): key is string => Boolean(key)),
    ),
  )
}

export async function cleanupGeneratedAssetsForTasks(taskIds: string[]): Promise<GeneratedAssetCleanupResult> {
  const uniqueTaskIds = Array.from(new Set(taskIds.filter(Boolean)))
  if (!uniqueTaskIds.length) {
    return { assetRecords: 0, r2Objects: 0, skippedAssets: 0 }
  }

  const assets = await prisma.generatedAsset.findMany({
    where: { taskId: { in: uniqueTaskIds } },
    select: { id: true, taskId: true, r2Key: true },
  })
  const keys = collectR2Keys(assets)
  const deletedObjects = await deleteR2Keys(keys)

  return {
    assetRecords: assets.length,
    r2Objects: deletedObjects,
    skippedAssets: assets.length - keys.length,
  }
}
