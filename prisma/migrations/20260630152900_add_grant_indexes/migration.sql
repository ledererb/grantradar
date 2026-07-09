-- CreateIndex
-- Support filtering by deadline alone (e.g. "closing soon" queries) without
-- needing status as a leading column.
CREATE INDEX IF NOT EXISTS "Grant_deadline_idx" ON "Grant"("deadline");

-- CreateIndex
-- The grants API joins Grants -> Source frequently; index the FK column.
CREATE INDEX IF NOT EXISTS "Grant_sourceId_idx" ON "Grant"("sourceId");

-- CreateIndex
-- "New grants" / "recently added" ordering by firstSeenAt.
CREATE INDEX IF NOT EXISTS "Grant_firstSeenAt_idx" ON "Grant"("firstSeenAt");

-- CreateIndex
-- Crawl cycles use lastScrapedAt to decide what to re-scrape.
CREATE INDEX IF NOT EXISTS "Grant_lastScrapedAt_idx" ON "Grant"("lastScrapedAt");

-- CreateIndex
-- Trigram GIN index for fast case-insensitive LIKE/ILIKE on titles,
-- which the /api/grants text search uses heavily. Requires pg_trgm.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "Grant_titleHu_trgm_idx"
  ON "Grant" USING gin ("titleHu" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Grant_titleEn_trgm_idx"
  ON "Grant" USING gin ("titleEn" gin_trgm_ops);
