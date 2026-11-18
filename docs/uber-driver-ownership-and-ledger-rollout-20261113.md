# Uber individual earnings: production isolation and rollout gate (2026-11-13)

Status: **design only; NOT executed against Supabase**. Never enable automated writes to `Appli` based on this document alone.

## Verified current Supabase schema
`taxi_uber_driver_earnings_staging` has `driver_external_id`, `external_payment_id`, `source`, `local_service_date`, `net_cents`, `raw_payload` but no `user_id`.
`taxi_uber_payments` has `user_id`, `payment_id`, `amount_cents`, `cash_collected_cents`, `trip_id` but no `driver_external_id`.
These columns **cannot** establish which Mon Taxi account owns a Fleet payment. The existing preflight correctly fails closed.

## Required safe rollout, in order
1. Export and verify a restorable database backup (including current user financial data); record backup timestamp and restore procedure. Do not restore over production.
2. Obtain Uber's official approval and the exact Fleet Supplier scopes/endpoints and driver-to-fleet access; do not infer earnings rights from `partner.payments` OAuth. Keep tokens only in server-side secrets/encrypted storage.
3. Establish an explicit, verified mapping `(authenticated Mon Taxi user_id, provider, Uber driver_external_id, fleet_id, authorization status)` with unique verified owner per driver and RLS; never infer ownership from a display name.
4. Create an append-only import ledger in a reviewed migration, keyed by `(provider, provider_payment_id, verified_driver_id)`, with a unique constraint and transactional insertion. Also reconcile across Fleet and official exports using a stable canonical Uber payment ID, not `source` as part of the deduplication key. Ambiguous or conflicting IDs must be quarantined.
5. Import into isolated staging first. Validate EUR, cent-integer arithmetic, timezone/service date, cash collected, reversals, adjustments, net-versus-gross definitions, and refunds. Do not add a cash-collected trip to `Appli` a second time. A payout and its constituent trips must not both count as revenue.
6. Dry-run with official Uber statement totals and human review. Only after matched totals and an idempotent replay test may an authenticated server-side atomic transaction post a confirmed amount to `Appli` without overwriting manual entries. Ensure Chrome/Android read the same existing data contract.
7. Verify repeated imports, concurrent imports, late refunds, mismatched drivers, cross-user RLS, and restore from backup in a nonproduction environment before production rollout.

## Authorized fallback
If Fleet Supplier access is not granted, accept a user-provided official Uber CSV/statement through an authenticated, reviewed, staged import. No credential scraping, browser automation of the Driver account, or unofficial API.

## Read-only inspection SQL (safe to run)
```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('taxi_uber_driver_earnings_staging','taxi_uber_payments')
order by table_name, ordinal_position;
```

Do not apply any schema migration or revenue posting until ownership mapping, backup, official authorization and accounting reconciliation have been verified.
