ALTER TABLE "ModelConfig"
ADD COLUMN "lowQualityUpstreamProviderId" TEXT,
ADD COLUMN "highQualityUpstreamProviderId" TEXT;

CREATE INDEX "ModelConfig_lowQualityUpstreamProviderId_idx"
ON "ModelConfig"("lowQualityUpstreamProviderId");

CREATE INDEX "ModelConfig_highQualityUpstreamProviderId_idx"
ON "ModelConfig"("highQualityUpstreamProviderId");

ALTER TABLE "ModelConfig"
ADD CONSTRAINT "ModelConfig_lowQualityUpstreamProviderId_fkey"
FOREIGN KEY ("lowQualityUpstreamProviderId") REFERENCES "UpstreamProvider"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ModelConfig"
ADD CONSTRAINT "ModelConfig_highQualityUpstreamProviderId_fkey"
FOREIGN KEY ("highQualityUpstreamProviderId") REFERENCES "UpstreamProvider"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
