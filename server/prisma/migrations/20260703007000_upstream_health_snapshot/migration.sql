ALTER TABLE "UpstreamProvider"
  ADD COLUMN "lastCheckedAt" TIMESTAMP(3),
  ADD COLUMN "lastHealthStatus" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "lastLatencyMs" INTEGER,
  ADD COLUMN "lastHttpStatus" INTEGER,
  ADD COLUMN "lastHealthMessage" TEXT NOT NULL DEFAULT '';
