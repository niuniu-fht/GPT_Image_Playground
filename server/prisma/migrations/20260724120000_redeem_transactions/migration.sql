CREATE TABLE "RedeemTransaction" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "redeemCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "externalConsumed" BOOLEAN NOT NULL DEFAULT false,
    "externalCodeId" INTEGER,
    "externalUserId" INTEGER,
    "externalUsedAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RedeemTransaction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CreditRedemption" ADD COLUMN "transactionId" TEXT;

CREATE UNIQUE INDEX "RedeemTransaction_requestId_key" ON "RedeemTransaction"("requestId");
CREATE INDEX "RedeemTransaction_userId_redeemCodeId_createdAt_idx" ON "RedeemTransaction"("userId", "redeemCodeId", "createdAt");
CREATE INDEX "RedeemTransaction_status_updatedAt_idx" ON "RedeemTransaction"("status", "updatedAt");
CREATE UNIQUE INDEX "RedeemTransaction_active_user_code_key"
    ON "RedeemTransaction"("userId", "redeemCodeId")
    WHERE "status" IN ('pending', 'consuming', 'remote_consumed', 'finalizing');
CREATE UNIQUE INDEX "CreditRedemption_transactionId_key" ON "CreditRedemption"("transactionId");

ALTER TABLE "RedeemTransaction" ADD CONSTRAINT "RedeemTransaction_redeemCodeId_fkey"
    FOREIGN KEY ("redeemCodeId") REFERENCES "RedeemCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RedeemTransaction" ADD CONSTRAINT "RedeemTransaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditRedemption" ADD CONSTRAINT "CreditRedemption_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "RedeemTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
