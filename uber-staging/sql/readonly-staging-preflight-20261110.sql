-- Read-only Uber staging preflight; never writes to financial tables.
-- Run only with authorized access. Returns counts, not driver identifiers.
select
  count(*) as staged_events,
  count(*) filter (where external_payment_id is null or btrim(external_payment_id::text) = '') as missing_event_ids,
  count(*) filter (where driver_external_id is null or btrim(driver_external_id::text) = '') as missing_driver_ids
from public.taxi_uber_driver_earnings_staging;

-- Detect conflicting records across sources for the same driver and trip
-- after the source schema has been verified to contain a stable trip identifier.
-- Do not infer that external_payment_id is a trip ID: it may be a payout/event ID.
-- Existing unique index (source, external_payment_id) does not cover cross-source duplicates.
-- No automatic publication to Appli is permitted until reconciliation is validated.
