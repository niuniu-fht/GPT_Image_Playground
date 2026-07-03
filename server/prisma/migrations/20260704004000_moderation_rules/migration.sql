CREATE TABLE "ModerationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'keyword',
    "pattern" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'block',
    "message" TEXT NOT NULL DEFAULT '提示词包含平台暂不支持的内容，请调整后重试',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModerationRule_enabled_priority_idx" ON "ModerationRule"("enabled", "priority");
