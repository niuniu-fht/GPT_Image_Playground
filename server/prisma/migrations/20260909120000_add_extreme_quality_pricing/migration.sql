ALTER TABLE "ModelConfig"
  ADD COLUMN "xhighQualityEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "xhighQuality1KEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "xhighQuality2KEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "xhighQuality4KEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "xhighQualityCostCredits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "xhighQualityCostCredits2K" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "xhighQualityCostCredits4K" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxQualityEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maxQuality1KEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maxQuality2KEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maxQuality4KEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maxQualityCostCredits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxQualityCostCredits2K" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxQualityCostCredits4K" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "xhighQualityUpstreamModel" TEXT,
  ADD COLUMN "maxQualityUpstreamModel" TEXT,
  ADD COLUMN "xhighQualityUpstreamProviderId" TEXT,
  ADD COLUMN "maxQualityUpstreamProviderId" TEXT;

CREATE INDEX "ModelConfig_xhighQualityUpstreamProviderId_idx" ON "ModelConfig"("xhighQualityUpstreamProviderId");
CREATE INDEX "ModelConfig_maxQualityUpstreamProviderId_idx" ON "ModelConfig"("maxQualityUpstreamProviderId");
ALTER TABLE "ModelConfig" ADD CONSTRAINT "ModelConfig_xhighQualityUpstreamProviderId_fkey" FOREIGN KEY ("xhighQualityUpstreamProviderId") REFERENCES "UpstreamProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModelConfig" ADD CONSTRAINT "ModelConfig_maxQualityUpstreamProviderId_fkey" FOREIGN KEY ("maxQualityUpstreamProviderId") REFERENCES "UpstreamProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
