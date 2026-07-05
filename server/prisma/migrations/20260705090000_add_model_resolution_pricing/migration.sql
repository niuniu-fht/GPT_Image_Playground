ALTER TABLE "ModelConfig" ADD COLUMN "costCredits2K" INTEGER;
ALTER TABLE "ModelConfig" ADD COLUMN "costCredits4K" INTEGER;

UPDATE "ModelConfig"
SET
  "costCredits2K" = GREATEST("costCredits" * 2, "costCredits"),
  "costCredits4K" = GREATEST("costCredits" * 4, "costCredits");

ALTER TABLE "ModelConfig" ALTER COLUMN "costCredits2K" SET NOT NULL;
ALTER TABLE "ModelConfig" ALTER COLUMN "costCredits4K" SET NOT NULL;
ALTER TABLE "ModelConfig" ALTER COLUMN "costCredits2K" SET DEFAULT 0;
ALTER TABLE "ModelConfig" ALTER COLUMN "costCredits4K" SET DEFAULT 0;
