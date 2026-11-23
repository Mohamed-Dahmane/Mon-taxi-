-- Uber -> Appli: READ-ONLY production safety audit (2026-11-13).
-- Run manually with read-only permissions. Never execute imports from this file.
-- No personal identifiers, tokens or raw financial payloads are selected.
SELECT 'uber_staging' AS check_name, count(*) AS row_count FROM public.taxi_uber_driver_earnings_staging
UNION ALL SELECT 'uber_payments',count(*) FROM public.taxi_uber_payments
UNION ALL SELECT 'uber_credentials',count(*) FROM public.taxi_uber_credentials
UNION ALL SELECT 'uber_oauth_states',count(*) FROM public.taxi_uber_oauth_states;
-- Detect existing duplicates within staging (source differences must not hide a collision).
SELECT count(*) AS duplicate_payment_id_groups FROM (
 SELECT driver_external_id,external_payment_id FROM public.taxi_uber_driver_earnings_staging
 GROUP BY driver_external_id,external_payment_id HAVING count(*)>1
) AS collisions;
-- Inspect uniqueness constraints: current payments PK is (user_id,payment_id);
-- this alone does NOT enforce global payment identity or chauffeur ownership.
SELECT tc.table_name,tc.constraint_name,tc.constraint_type,
 string_agg(kcu.column_name,', ' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
 ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema AND tc.table_name=kcu.table_name
WHERE tc.table_schema='public' AND tc.table_name IN
 ('taxi_uber_driver_earnings_staging','taxi_uber_payments','taxi_uber_credentials')
 AND tc.constraint_type IN ('PRIMARY KEY','UNIQUE')
GROUP BY tc.table_name,tc.constraint_name,tc.constraint_type ORDER BY tc.table_name,tc.constraint_name;
-- Fail closed: no posting until official entitlement, verified user-driver mapping,
-- durable deduplication, atomic transaction and restorable backup are demonstrated.
