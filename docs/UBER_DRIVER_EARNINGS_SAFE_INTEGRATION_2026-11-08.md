# Uber driver earnings — safe integration gate (2026-11-08)

Status: **NOT CONNECTED**. This document is a non-production implementation checklist. Do not write to daily/monthly receipts until all gates below pass.

## Verified current state
- Supabase project: mon-taxi-v11. Edge function taxi-uber-oauth deployed v2; no evidence of a completed authorized Uber connection.
- Counts at inspection: taxi_uber_credentials=0, taxi_uber_payments=0, taxi_uber_driver_earnings_staging=0, taxi_uber_oauth_states=0.
- Unique indexes: staging (source, external_payment_id), payments (user_id, payment_id). These alone do not prove end-to-end idempotency.
- Chrome/Android sync and APK monitoring must remain untouched.

## Official source gate
1. Determine whether the driver belongs to an Uber fleet and whether the fleet owner can grant official Uber Fleet Supplier access to that driver's trip/earnings data. Confirm approved scopes, actual endpoints, data granularity and contractual authorization in Uber documentation/portal; do not assume `partner.payments` covers individual real-time earnings.
2. If not available, accept only driver-authorized Uber exports/statements via a deliberate import workflow. Do not scrape the Driver app, bypass anti-bot measures, or request credentials outside the official authorization flow.
3. Store access/refresh tokens server-side only, encrypted and scoped to the authenticated user. Never commit tokens, secrets, raw identifiers, or financial records.

## Import and reconciliation gates
1. Capture a sanitized example payload with an official stable trip/payment ID, driver ID, service date with Europe/Brussels timezone, amount, currency, transaction status, and update timestamp. Distinguish trip earnings from payouts, fees, adjustments, tips and reversals.
2. Validate authorization and driver ownership on the server; reject unknown driver, currency or missing stable ID. Normalize amounts as integer euro cents; never silently round source values.
3. Upsert to staging using stable (source, external_payment_id), with updates for legitimate corrections; ensure duplicate replays cannot increase totals. Verify with repeated payload, reordered payload, and correction/reversal tests.
4. Compare staged daily totals with an authorized Uber statement. Record source timestamps and a reconciliation audit trail. Manual Appli values remain authoritative until user-approved migration; never add imported amounts on top of existing manual totals.
5. Only after validated reconciliation, design an explicit, reversible per-day adoption mechanism that preserves manual entries and existing Chrome/Android synchronization. Take a recoverable backup and test restore first.
6. Run read-only production checks after any staged tests; do not deploy unreviewed database triggers or alter existing financial tables.

## Acceptance evidence
- Official API entitlement confirmed or authorized export obtained.
- Same external transaction imported twice yields exactly one staged record.
- Correction/reversal produces correct net daily total.
- No change to current receipts before explicit adoption.
- Android and Chrome show identical daily/monthly amounts before and after controlled tests.
- No tokens or secrets in GitHub, browser logs, or client bundles.
