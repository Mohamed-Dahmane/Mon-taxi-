-- Uber -> Appli preflight, READ ONLY. Run before any import or reconciliation.
-- No credentials, raw_payload or user identifiers are returned.
select 'credentials' as source, count(*) as rows from public.taxi_uber_credentials
union all select 'oauth_states', count(*) from public.taxi_uber_oauth_states
union all select 'staging', count(*) from public.taxi_uber_driver_earnings_staging
union all select 'payments', count(*) from public.taxi_uber_payments;

-- Detect repeated payment keys without revealing the identifiers.
select count(*) as duplicate_payment_key_groups from (
  select user_id, payment_id from public.taxi_uber_payments
  group by user_id, payment_id having count(*) > 1
) x;

-- Detect repeated staging events; source + driver + external id is the current provisional key.
select count(*) as duplicate_staging_key_groups from (
  select source, driver_external_id, external_payment_id
  from public.taxi_uber_driver_earnings_staging
  group by source, driver_external_id, external_payment_id having count(*) > 1
) x;

-- This audit does NOT prove cross-source trip uniqueness: staging lacks a dedicated trip_id,
-- event_kind, original_event_id and authenticated user_id.
-- Do NOT automatically update Appli. Preserve manual amounts and existing sync.
-- Require official Fleet Supplier access or authorized driver export, server-side identity binding,
-- event-level deduplication across sources and explicit reconciliation before enabling writes.
