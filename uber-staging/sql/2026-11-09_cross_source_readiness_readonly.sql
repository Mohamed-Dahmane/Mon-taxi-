-- Uber staging pre-promotion audit (READ ONLY). 2026-11-09.
-- No raw_payload, credentials, personal identifiers, or financial rows are returned.
-- Do NOT connect staging to Appli until ownership, trip-level uniqueness,
-- correction links and manual-entry reconciliation are implemented and tested.
WITH required(table_name,column_name) AS (
 VALUES
 ('taxi_uber_driver_earnings_staging','user_id'),
 ('taxi_uber_driver_earnings_staging','trip_id'),
 ('taxi_uber_driver_earnings_staging','event_kind'),
 ('taxi_uber_driver_earnings_staging','original_event_id'),
 ('taxi_uber_driver_earnings_staging','external_payment_id'),
 ('taxi_uber_payments','user_id'),
 ('taxi_uber_payments','trip_id')
)
SELECT r.table_name,r.column_name,
       (c.column_name IS NOT NULL) AS present
FROM required r
LEFT JOIN information_schema.columns c
 ON c.table_schema='public' AND c.table_name=r.table_name
 AND c.column_name=r.column_name
ORDER BY r.table_name,r.column_name;

-- Aggregate only: repeated source/external ID and same-driver/day records.
-- Counts are not evidence that two different source IDs refer to the same trip.
SELECT 'staging_repeated_source_payment_id' AS check_name,
       count(*)::bigint AS duplicate_groups
FROM (
 SELECT source,external_payment_id
 FROM public.taxi_uber_driver_earnings_staging
 WHERE external_payment_id IS NOT NULL
 GROUP BY source,external_payment_id HAVING count(*)>1
) d
UNION ALL
SELECT 'payments_repeated_user_payment_id',count(*)::bigint
FROM (
 SELECT user_id,payment_id FROM public.taxi_uber_payments
 WHERE payment_id IS NOT NULL
 GROUP BY user_id,payment_id HAVING count(*)>1
) d
UNION ALL
SELECT 'payments_repeated_user_trip_id',count(*)::bigint
FROM (
 SELECT user_id,trip_id FROM public.taxi_uber_payments
 WHERE trip_id IS NOT NULL
 GROUP BY user_id,trip_id HAVING count(*)>1
) d;

-- A zero duplicate count does NOT establish safe cross-source reconciliation.
-- Before promotion: use an authorized Uber source, server-side ownership
-- verification, durable idempotency and a separate review queue; never
-- overwrite existing daily Appli entries or infer earnings from payouts.
