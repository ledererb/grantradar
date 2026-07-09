-- AlterTable
-- Track failed AI enrichment attempts so the auto-enrich cron can back off.
ALTER TABLE "Grant" ADD COLUMN "enrichmentAttempts" INTEGER NOT NULL DEFAULT 0;
