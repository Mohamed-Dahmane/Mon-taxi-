-- Uber security readiness: READ ONLY, no rows containing user data or secrets.
-- Run only as a privileged reviewer; never expose credential payloads.
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       count(p.policyname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname=n.nspname AND p.tablename=c.relname
WHERE n.nspname='public'
  AND c.relname IN ('taxi_uber_credentials','taxi_uber_oauth_states',
                    'taxi_uber_driver_earnings_staging','taxi_uber_payments')
GROUP BY c.relname,c.relrowsecurity
ORDER BY c.relname;

-- Show uniqueness constraint/index definitions only, never financial records.
SELECT t.relname AS table_name, i.relname AS index_name,
       ix.indisunique AS unique_index,
       pg_get_indexdef(ix.indexrelid) AS index_definition
FROM pg_index ix
JOIN pg_class t ON t.oid=ix.indrelid
JOIN pg_class i ON i.oid=ix.indexrelid
JOIN pg_namespace n ON n.oid=t.relnamespace
WHERE n.nspname='public'
  AND t.relname IN ('taxi_uber_driver_earnings_staging','taxi_uber_payments')
ORDER BY t.relname,i.relname;

-- BLOCK: staging lacks user_id, trip_id, event_kind and original_event_id.
-- RLS alone is not sufficient: server-side driver/fleet ownership validation,
-- durable cross-source trip deduplication, correction linkage and reconciliation
-- with manually entered Appli amounts are mandatory before promotion.
-- Do not connect this staging table to the production Appli totals.
