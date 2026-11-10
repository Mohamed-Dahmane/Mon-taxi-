-- Read-only Uber integration preflight for mon-taxi-v11.
-- Run in Supabase SQL editor; no changes, no secrets, no financial row data.
-- Counts are snapshots, not proof of synchronization or recoverable backups.
SELECT t.table_name,
       (SELECT count(*) FROM information_schema.columns c
         WHERE c.table_schema='public' AND c.table_name=t.table_name) AS column_count,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM information_schema.tables t
JOIN pg_class c ON c.oid=to_regclass(format('%I.%I',t.table_schema,t.table_name))
WHERE t.table_schema='public'
  AND t.table_name IN ('taxi_uber_credentials','taxi_uber_oauth_states',
    'taxi_uber_driver_earnings_staging','taxi_uber_payments')
ORDER BY t.table_name;

-- Check that database-level unique constraints exist before considering replay-safe ingestion.
-- A missing constraint is a deployment blocker; application-side checks alone are insufficient.
SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
       string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_catalog=kcu.constraint_catalog
 AND tc.constraint_schema=kcu.constraint_schema
 AND tc.constraint_name=kcu.constraint_name
 AND tc.table_name=kcu.table_name
WHERE tc.table_schema='public'
 AND tc.table_name IN ('taxi_uber_driver_earnings_staging','taxi_uber_payments')
 AND tc.constraint_type IN ('UNIQUE','PRIMARY KEY')
GROUP BY tc.table_name,tc.constraint_name,tc.constraint_type
ORDER BY tc.table_name,tc.constraint_name;

-- This script intentionally does NOT read token values or modify Appli.
