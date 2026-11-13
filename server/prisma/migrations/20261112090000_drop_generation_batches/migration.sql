-- 回滚批量生图服务端队列：改用前端队列驱动（复用单图管线），服务端不再需要批次表
DROP TABLE IF EXISTS "GenerationBatchItem";
DROP TABLE IF EXISTS "GenerationBatch";
DROP INDEX IF EXISTS "GenerationTask_batchId_idx";
ALTER TABLE "GenerationTask" DROP COLUMN IF EXISTS "batchId";
