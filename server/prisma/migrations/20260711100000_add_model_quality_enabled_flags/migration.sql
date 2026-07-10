ALTER TABLE "ModelConfig"
ADD COLUMN "lowQualityEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mediumQualityEnabled" BOOLEAN NOT NULL DEFAULT true;

UPDATE "ModelConfig"
SET
  "lowQualityEnabled" = true,
  "mediumQualityEnabled" = true
WHERE "upstreamModel" ILIKE 'gpt-image%' OR "name" ILIKE 'gpt-image%';
