-- Uber driver earnings: extended READ-ONLY readiness checks (2026-11-09).
-- No PII, tokens, raw payload, trip identifiers or monetary amounts returned.
-- Run against mon-taxi-v11; no production writes.
SELECT table_name, count(*) AS column_count,
  bool_or(column_name='user_id') AS has_user_binding,
  bool_or(column_name='trip_id') AS has_trip_id,
  bool_or(column_name='event_kind') AS has_event_kind,
  bool_or(column_name='original_event_id') AS has_original_event_id
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN
 ('taxi_uber_driver_earnings_staging','taxi_uber_payments')
GROUP BY table_name ORDER BY table_name;

-- Read-only counts: no user-identifying rows.
SELECT 'credentials' AS kind,count(*) AS rows FROM public.taxi_uber_credentials
UNION ALL SELECT 'oauth_states',count(*) FROM public.taxi_uber_oauth_states
UNION ALL SELECT 'staging',count(*) FROM public.taxi_uber_driver_earnings_staging
UNION ALL SELECT 'payments',count(*) FROM public.taxi_uber_payments;

-- Payment records without a trip reference cannot be safely matched cross-source.
SELECT count(*) AS payments_without_trip_id FROM public.taxi_uber_payments
WHERE trip_id IS NULL OR btrim(trip_id)='';

-- Duplicated trip IDs per authenticated user; do not expose IDs.
SELECT count(*) AS duplicated_user_trip_groups FROM (
 SELECT user_id,trip_id FROM public.taxi_uber_payments
 WHERE trip_id IS NOT NULL AND btrim(trip_id)<>''
 GROUP BY user_id,trip_id HAVING count(*)>1
) duplicates;

-- BLOCKER: staging currently lacks authenticated user_id, trip_id, event_kind,
-- original_event_id. Do not promote records into Appli until ownership,
-- source-independent trip deduplication, adjustment semantics, and a
-- reversible reconciliation against manual entries are implemented and tested.
-- Fleet Supplier requires approved Uber access and fleet/driver authorization.
-- Alternative: explicitly authorized Uber driver export, same validation rules.
