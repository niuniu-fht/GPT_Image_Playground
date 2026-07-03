CREATE TABLE "RedeemCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "maxRedemptions" INTEGER NOT NULL DEFAULT 1,
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedeemCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditRedemption" (
    "id" TEXT NOT NULL,
    "redeemCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RedeemCode_code_key" ON "RedeemCode"("code");
CREATE INDEX "RedeemCode_status_startsAt_endsAt_idx" ON "RedeemCode"("status", "startsAt", "endsAt");
CREATE INDEX "CreditRedemption_userId_createdAt_idx" ON "CreditRedemption"("userId", "createdAt");
CREATE INDEX "CreditRedemption_redeemCodeId_createdAt_idx" ON "CreditRedemption"("redeemCodeId", "createdAt");

ALTER TABLE "CreditRedemption" ADD CONSTRAINT "CreditRedemption_redeemCodeId_fkey" FOREIGN KEY ("redeemCodeId") REFERENCES "RedeemCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditRedemption" ADD CONSTRAINT "CreditRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
