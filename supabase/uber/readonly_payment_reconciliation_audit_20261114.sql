-- Uber earnings staging: read-only reconciliation audit (2026-11-14).
-- Does not import, promote, update, or delete any financial data.
-- Run with read-only database credentials. Never expose raw_payload or OAuth tokens.
BEGIN READ ONLY;
SELECT 'credentials' AS dataset, count(*) AS records FROM public.taxi_uber_credentials
UNION ALL SELECT 'oauth_states', count(*) FROM public.taxi_uber_oauth_states
UNION ALL SELECT 'payments', count(*) FROM public.taxi_uber_payments
UNION ALL SELECT 'staged_earnings', count(*) FROM public.taxi_uber_driver_earnings_staging;
-- Duplicate external identifiers (should return zero rows).
SELECT source, external_payment_id, count(*) AS occurrences
FROM public.taxi_uber_driver_earnings_staging
GROUP BY source, external_payment_id HAVING count(*) > 1;
SELECT user_id, payment_id, count(*) AS occurrences
FROM public.taxi_uber_payments
GROUP BY user_id, payment_id HAVING count(*) > 1;
-- Potentially invalid or unverified staging rows (counts only).
SELECT count(*) FILTER (WHERE driver_external_id IS NULL OR btrim(driver_external_id) = '') AS missing_driver,
       count(*) FILTER (WHERE currency <> 'EUR' OR currency IS NULL) AS non_eur,
       count(*) FILTER (WHERE external_payment_id IS NULL OR btrim(external_payment_id) = '') AS missing_payment_id,
       count(*) FILTER (WHERE local_service_date IS NULL) AS missing_service_date
FROM public.taxi_uber_driver_earnings_staging;
ROLLBACK;
