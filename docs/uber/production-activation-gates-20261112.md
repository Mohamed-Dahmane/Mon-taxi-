# Uber earnings → Appli: production activation gates (2026-11-12)

Status: **NOT CONNECTED**. This document is a non-executable checklist; it does not authorize any production import.

## Source and permissions
- Confirm whether the driver belongs to an Uber Fleet Supplier fleet and whether the fleet operator is authorized to access this driver's earnings.
- Obtain Uber's official written API scope/approval and verify exact endpoint, driver identity, ownership, pagination and payment semantics against Uber's current documentation. Existing `partner.payments` configuration alone is not proof of Fleet Supplier permission.
- If unavailable, accept only a driver-provided official Uber export through a separately reviewed manual import. Never scrape credentials, bypass access controls or collect driver passwords.

## Data protection and accounting
- Keep existing manual `Appli` entries immutable. Store imported events separately as pending; do not add them to daily revenue until the operator approves a reconciliation rule.
- Use a database unique constraint keyed by provider, authorized driver, and immutable provider event ID. Make inserts idempotent; reject conflicting replays and isolate other drivers. Do not deduplicate solely by date or amount.
- Store currency in integer cents, preserve original timestamps with Brussels-local accounting day, and classify fare, tip, refund and adjustment separately. Validate negative amounts and cancellations.
- Never expose API secrets or refresh tokens in browser, Android bundle, logs or repository. Server-side credentials only, least privilege and row-level security.
- Before any schema/deployment change, take and verify a restorable database backup. Existing rows in `taxi_management_backups` do not themselves prove a fresh restorable database backup.

## Release gates
1. Confirm official Uber access and a sample response for the correct driver (redacted).
2. Test importer offline with fixtures for pagination, duplicate replay, contradictory events, timezone boundaries and mixed drivers.
3. Test against a non-production Supabase environment and confirm row counts, uniqueness and RLS.
4. Compare a known Uber weekly statement against the proposed daily totals; resolve payout vs trip-earning semantics.
5. Verify Chrome/Android synchronization with existing manual data untouched and a rollback tested.
6. Enable production ingestion only after explicit approval; publish proof of a real imported event before claiming synchronization.

As of the 2026-11-12 read-only inspection, `taxi_uber_credentials`, `taxi_uber_payments`, `taxi_uber_driver_earnings_staging` and `taxi_uber_oauth_states` all contained zero rows. No import is active or proven.
