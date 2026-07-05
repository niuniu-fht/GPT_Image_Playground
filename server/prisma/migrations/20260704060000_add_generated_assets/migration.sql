CREATE TABLE "GeneratedAsset" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageIndex" INTEGER NOT NULL,
    "r2Key" TEXT,
    "publicUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "uploadMode" TEXT,
    "source" TEXT NOT NULL DEFAULT 'generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GeneratedAsset_taskId_imageIndex_key" ON "GeneratedAsset"("taskId", "imageIndex");
CREATE INDEX "GeneratedAsset_userId_createdAt_idx" ON "GeneratedAsset"("userId", "createdAt");
CREATE INDEX "GeneratedAsset_r2Key_idx" ON "GeneratedAsset"("r2Key");

ALTER TABLE "GeneratedAsset" ADD CONSTRAINT "GeneratedAsset_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "GenerationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedAsset" ADD CONSTRAINT "GeneratedAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
