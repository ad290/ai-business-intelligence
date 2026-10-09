-- Enable pgvector in the existing ai_business database (no app schema changes).
CREATE EXTENSION IF NOT EXISTS vector;

-- Smoke test: vector type and distance operator work (no persistent tables).
DO $$
DECLARE
  dist double precision;
BEGIN
  dist := (SELECT '[1,2,3]'::vector(3) <-> '[1,2,4]'::vector(3));
  IF dist IS NULL OR dist <= 0 THEN
    RAISE EXCEPTION 'pgvector smoke test failed: unexpected distance %', dist;
  END IF;
END $$;
