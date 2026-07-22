ALTER TABLE "GenerationTask" ADD COLUMN "clientRequestId" TEXT;

UPDATE "GenerationTask" SET "clientRequestId" = "id" WHERE "clientRequestId" IS NULL;

ALTER TABLE "GenerationTask" ALTER COLUMN "clientRequestId" SET NOT NULL;

CREATE UNIQUE INDEX "GenerationTask_userId_clientRequestId_key"
  ON "GenerationTask"("userId", "clientRequestId");
