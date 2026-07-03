CREATE TABLE "LoginLog" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "userId" TEXT,
  "success" BOOLEAN NOT NULL,
  "reason" TEXT NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginLog_createdAt_idx" ON "LoginLog"("createdAt");
CREATE INDEX "LoginLog_email_createdAt_idx" ON "LoginLog"("email", "createdAt");
CREATE INDEX "LoginLog_userId_createdAt_idx" ON "LoginLog"("userId", "createdAt");
CREATE INDEX "LoginLog_success_createdAt_idx" ON "LoginLog"("success", "createdAt");

ALTER TABLE "LoginLog" ADD CONSTRAINT "LoginLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
