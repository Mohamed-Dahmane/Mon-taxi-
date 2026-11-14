-- Read-only Uber readiness audit for mon-taxi-v11.
-- No secrets, no row payloads, no mutations. Run with read-only permissions.
SELECT 'taxi_uber_credentials' AS source, count(*) AS row_count FROM public.taxi_uber_credentials
UNION ALL SELECT 'taxi_uber_oauth_states', count(*) FROM public.taxi_uber_oauth_states
UNION ALL SELECT 'taxi_uber_payments', count(*) FROM public.taxi_uber_payments
UNION ALL SELECT 'taxi_uber_driver_earnings_staging', count(*) FROM public.taxi_uber_driver_earnings_staging
ORDER BY source;

-- Inspect uniqueness constraints/indexes before designing any idempotent posting.
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('taxi_uber_payments','taxi_uber_driver_earnings_staging')
ORDER BY tablename, indexname;

-- Check whether any driver identity mapping is represented by named columns.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('taxi_uber_payments','taxi_uber_driver_earnings_staging')
ORDER BY table_name, ordinal_position;
