ALTER TABLE "ModelConfig"
ADD COLUMN "lowQuality1KEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lowQuality2KEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lowQuality4KEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mediumQuality1KEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mediumQuality2KEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mediumQuality4KEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "highQuality1KEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "highQuality2KEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "highQuality4KEnabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ModelConfig"
SET
  "lowQuality1KEnabled" = "lowQualityEnabled",
  "lowQuality2KEnabled" = "lowQualityEnabled",
  "lowQuality4KEnabled" = "lowQualityEnabled",
  "mediumQuality1KEnabled" = "mediumQualityEnabled",
  "mediumQuality2KEnabled" = "mediumQualityEnabled",
  "mediumQuality4KEnabled" = "mediumQualityEnabled",
  "highQuality1KEnabled" = "highQualityEnabled",
  "highQuality2KEnabled" = "highQualityEnabled",
  "highQuality4KEnabled" = "highQualityEnabled";
