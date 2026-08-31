ALTER TABLE "ModelConfig"
ADD COLUMN "unsupportedAspectRatios" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
