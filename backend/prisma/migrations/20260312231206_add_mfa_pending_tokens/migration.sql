-- CreateTable
CREATE TABLE "mfa_pending_tokens" (
    "jti" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mfa_pending_tokens_pkey" PRIMARY KEY ("jti")
);

-- AddForeignKey
ALTER TABLE "mfa_pending_tokens" ADD CONSTRAINT "mfa_pending_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
