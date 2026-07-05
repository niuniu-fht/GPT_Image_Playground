CREATE TABLE "SquarePublisher" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SquarePublisher_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SquareShare" (
    "id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "manifestJson" JSONB NOT NULL,
    "coverAssetId" TEXT,
    "tags" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "clientRequestId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SquareShare_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SquareShareAsset" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "clientAssetId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "thumbR2Key" TEXT,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "thumbByteSize" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquareShareAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SquareReport" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "userId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquareReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SquarePublisher_token_key" ON "SquarePublisher"("token");
CREATE INDEX "SquarePublisher_userId_idx" ON "SquarePublisher"("userId");
CREATE UNIQUE INDEX "SquareShare_publisherId_clientRequestId_key" ON "SquareShare"("publisherId", "clientRequestId");
CREATE INDEX "SquareShare_status_kind_createdAt_idx" ON "SquareShare"("status", "kind", "createdAt");
CREATE INDEX "SquareShare_userId_createdAt_idx" ON "SquareShare"("userId", "createdAt");
CREATE INDEX "SquareShareAsset_shareId_createdAt_idx" ON "SquareShareAsset"("shareId", "createdAt");
CREATE INDEX "SquareReport_shareId_createdAt_idx" ON "SquareReport"("shareId", "createdAt");
CREATE INDEX "SquareReport_userId_createdAt_idx" ON "SquareReport"("userId", "createdAt");

ALTER TABLE "SquarePublisher" ADD CONSTRAINT "SquarePublisher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SquareShare" ADD CONSTRAINT "SquareShare_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "SquarePublisher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SquareShare" ADD CONSTRAINT "SquareShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SquareShareAsset" ADD CONSTRAINT "SquareShareAsset_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "SquareShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SquareReport" ADD CONSTRAINT "SquareReport_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "SquareShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SquareReport" ADD CONSTRAINT "SquareReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
