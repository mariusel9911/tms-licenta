-- AlterTable: Add AI feature toggles to AppSettings singleton
ALTER TABLE "app_settings" ADD COLUMN "aiChatbotEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "app_settings" ADD COLUMN "aiPredictionEnabled" BOOLEAN NOT NULL DEFAULT true;
