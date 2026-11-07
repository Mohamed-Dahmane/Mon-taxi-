# Uber driver earnings — import safety gates (2026-11-07)

Status: DESIGN ONLY. No production import or daily Appli mutation is authorized by this document.

## Verified schema
- `taxi_uber_driver_earnings_staging`: source, external_payment_id, driver_external_id, occurred_at, local_service_date, currency, gross_cents, fee_cents, net_cents, status, raw_payload, fetched_at.
- `taxi_uber_payments`: user_id, payment_id, event_time, amount_cents, cash_collected_cents, currency, category, trip_id, updated_at.
- `taxi_uber_credentials` and `taxi_uber_oauth_states` exist.
- Edge function `taxi-uber-oauth` exists; no earnings-fetch Edge Function was listed at audit time.

## Mandatory gates before any import
1. Confirm the account is an authorized Fleet Supplier and that Uber has granted the exact earnings/payment endpoint and scopes. Never infer permission from a successful OAuth handshake. If unavailable, use authorized exports (driver statements / CSV) with explicit provenance and manual approval, not scraping or credential sharing.
2. Confirm whether each API row is a trip earning, adjustment, cash collection, or payout transfer. Do not count payouts as additional trips. Require individual driver identity and stable provider event/trip identifiers.
3. Store source records in staging first; require `EUR`, exact integer cents, timezone-aware timestamps, and validated net earnings semantics. Treat refunds, reversals and later adjustments explicitly rather than silently summing them.
4. Deduplicate within batches AND across runs in the database. A payment identifier alone may not uniquely identify a trip; do not conflate distinct adjustments. Check both staging and `taxi_uber_payments` before promoting records. On conflicting repeated IDs, quarantine and reconcile; never overwrite silently.
5. Never write directly to the existing Chrome/Android daily `Appli` totals. First compare imported Uber earnings with manually entered Appli amounts to avoid double counting. Only enable a reversible, opt-in reconciliation mechanism after tests and a backup.
6. Back up the relevant database tables and current app release before schema changes or deployment. Use a development branch and staging data for integration tests. Preserve the APK monitoring workflow untouched.
7. Test timezones (Europe/Brussels DST), pagination, API retries, overlapping fetch windows, repeated webhooks, partial failures, and reconciliation of historical days. Verify production data unchanged before/after each preparatory change.

## Current blockers
- No confirmed Uber Fleet Supplier grant or usable authorized earnings endpoint.
- No confirmed end-to-end payment fetch, import, or Chrome/Android Appli reconciliation.
- No claim of synchronized Uber earnings is justified.
