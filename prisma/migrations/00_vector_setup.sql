-- Enable the pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Function to search grants by vector similarity
CREATE OR REPLACE FUNCTION match_grants(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id text,
  "titleHu" text,
  code text,
  program text,
  status text,
  "fundingType" text,
  deadline timestamptz,
  "maxAmountHuf" bigint,
  "maxAmountEur" int,
  "aiSummaryHu" text,
  "sourceUrl" text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g."titleHu",
    g.code,
    g.program,
    g.status::"text",
    g."fundingType"::"text",
    g.deadline,
    g."maxAmountHuf",
    g."maxAmountEur",
    g."aiSummaryHu",
    g."sourceUrl",
    1 - (g.embedding <=> query_embedding) AS similarity
  FROM "Grant" g
  WHERE g.embedding IS NOT NULL
    AND 1 - (g.embedding <=> query_embedding) > match_threshold
    AND g.status IN ('OPEN', 'FORTHCOMING')
  ORDER BY g.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Index for faster vector similarity search
CREATE INDEX IF NOT EXISTS grant_embedding_idx ON "Grant"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
