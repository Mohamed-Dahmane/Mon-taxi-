# Uber earnings — authorization and safe activation checklist (2026-11-15)

Status: NOT CONNECTED. This document is preparation only; it does not enable an import or modify production earnings.

## Authorization gate
- Verify whether the driver belongs to an Uber fleet and whether the fleet administrator has approved access to the official Uber Fleet Supplier API and its earnings/payment scopes.
- Confirm the Uber account/driver identifier maps to the authenticated Mon Taxi user. Reject ambiguous mappings.
- Keep OAuth client credentials and refresh tokens in server-side Supabase secrets/encrypted storage only. Never ship them in the Chrome frontend, APK, logs, or repository.
- If Fleet Supplier permissions are unavailable, request a driver-authorized official export/statement and stage it for review; do not scrape Driver app sessions or use unofficial endpoints.

## Import contract (not yet enabled)
- Capture source, fleet identifier, driver identifier, immutable Uber trip/payment/event identifier, event type, currency, amount, timestamps and source revision.
- Enforce a unique idempotency key derived from source + fleet + driver + event type + immutable event identifier (plus adjustment identity where applicable). Replays must not add earnings twice.
- Store raw external events separately from user-entered daily `Appli` amounts; stage new records, quarantine collisions and corrections, and require reconciliation before posting.
- Distinguish trip earnings, tips, adjustments, fees, refunds and payouts. Do not sum both a trip and its payout as income.
- Preserve existing daily totals, manual entries, and Chrome/Android synchronization. Any activation needs a tested rollback and a verified backup.

## Acceptance checks before enabling
1. Obtain official authorization and a confirmed driver-to-user mapping.
2. Test on non-production data: first import, repeated import, adjustment, refund, wrong driver, expired OAuth, network retry, and partial failure.
3. Confirm zero duplicates and unchanged manual `Appli` amounts.
4. Compare staged totals with the official statement and inspect Chrome and Android side-by-side.
5. Take and verify a restorable database backup before any production write.

As of this document's creation, the four Uber tables have zero rows; `taxi-uber-oauth` being deployed does not prove earnings access or synchronization.
