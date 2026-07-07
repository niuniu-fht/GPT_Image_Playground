ALTER TABLE "ModelConfig"
ADD COLUMN "lowQualityCostCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lowQualityCostCredits2K" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lowQualityCostCredits4K" INTEGER NOT NULL DEFAULT 0;

UPDATE "ModelConfig"
SET
  "lowQualityCostCredits" = COALESCE(NULLIF("lowQualityCostCredits", 0), "costCredits"),
  "lowQualityCostCredits2K" = COALESCE(NULLIF("lowQualityCostCredits2K", 0), NULLIF("costCredits2K", 0), "costCredits" * 2),
  "lowQualityCostCredits4K" = COALESCE(NULLIF("lowQualityCostCredits4K", 0), NULLIF("costCredits4K", 0), "costCredits" * 4)
WHERE "name" = 'gpt-image-2';
