ALTER TABLE "ModelConfig"
ADD COLUMN "highQualityEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "highQualityCostCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "highQualityCostCredits2K" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "highQualityCostCredits4K" INTEGER NOT NULL DEFAULT 0;

UPDATE "ModelConfig"
SET
  "highQualityEnabled" = true,
  "highQualityCostCredits" = GREATEST("costCredits" * 2, "costCredits" + 1),
  "highQualityCostCredits2K" = GREATEST(COALESCE(NULLIF("costCredits2K", 0), "costCredits" * 2) * 2, COALESCE(NULLIF("costCredits2K", 0), "costCredits" * 2) + 1),
  "highQualityCostCredits4K" = GREATEST(COALESCE(NULLIF("costCredits4K", 0), "costCredits" * 4) * 2, COALESCE(NULLIF("costCredits4K", 0), "costCredits" * 4) + 1)
WHERE "name" = 'gpt-image-2';
