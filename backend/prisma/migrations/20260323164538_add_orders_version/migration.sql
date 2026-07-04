-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "ordersVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ai_prediction_cache" (
    "id" SERIAL NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "ordersVersion" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prediction_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_messages" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_prediction_cache_cacheKey_key" ON "ai_prediction_cache"("cacheKey");

-- AddForeignKey
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
