-- REVIEW ONLY. NOT APPLIED. Requires confirmed ownership mapping and staging schema review.
-- Verified 2026-11-09: current unique index (source, external_payment_id)
-- conflicts with normalizer key (source, driverId, externalEventId).
-- Preserve old index until source ID semantics and existing data are audited.
-- This index can be added without deleting or changing any rows; it does NOT
-- fix the restrictive old index, so do not interpret it as enabling imports.
-- Use a migration transaction after approval; do not use CONCURRENTLY inside a transaction.
CREATE UNIQUE INDEX IF NOT EXISTS taxi_uber_source_driver_payment_unique
ON public.taxi_uber_driver_earnings_staging
(source, driver_external_id, external_payment_id);
-- BEFORE any eventual drop of taxi_uber_source_id_unique:
-- (1) verify driver ownership server-side for each imported event,
-- (2) confirm whether external_payment_id is event ID or trip/payment ID,
-- (3) inspect FK, upsert ON CONFLICT targets and all ingestion callers,
-- (4) test replay, corrections, cross-driver collisions and rollback.
-- Do NOT write into Appli until manual entries and historical totals
-- have a verified reconciliation strategy.
