# Uber driver earnings: verified integration gate (2026-11-08)

This document is a non-executing implementation checklist. No financial data or production functions are changed by this commit.

## Observed production state
- Supabase project `mon-taxi-v11` (`uenyvsiturkihectolxp`) ACTIVE_HEALTHY.
- Edge function `taxi-uber-oauth` ACTIVE version 2, with JWT verification disabled at gateway but explicit authenticated-user check on POST /start.
- OAuth implementation currently requests **partner.payments**. This is not evidence of Uber Fleet Supplier entitlement.
- SQL count: `taxi_uber_credentials=0`, `taxi_uber_payments=0`, `taxi_uber_driver_earnings_staging=0`, `taxi_uber_oauth_states=0`.
- Chrome/Android synchronization and existing amounts must not be changed during authorization investigation.

## Official access gate
1. Establish whether driver belongs to an Uber fleet and whether the fleet owner can grant Supplier API access. Confirm Uber's current approved product, scopes, endpoints, and account eligibility in the Uber developer portal; do not assume `partner.payments` is sufficient for individual driver trip earnings.
2. If not eligible, seek an explicitly authorized export/report route from Uber Driver/Fleet or a documented partner integration. Never scrape the driver app, bypass access controls, or capture credentials.
3. Do not enable production ingestion until one authorized response can be reconciled against a real driver earnings record, including currency, timezone, trip identity, net vs gross amount, tips, fees, cash trips, and adjustments.

## Idempotent staging and reconciliation
- Keep provider source + immutable provider trip/payment ID + driver/account identity as a unique logical key; upsert by that key, never append blindly.
- Keep raw provider events separate from derived daily totals; corrections/adjustments must update or reverse prior amounts deterministically.
- Never double-count cash collected by the driver and never count both a trip and its payout as two revenues.
- Stage only; do not overwrite manual `Appli` values. Reconcile independently before enabling automatic posting.
- Apply least-privilege server-side secrets and RLS, redact tokens and PII from logs, and test replay/duplicate, retry, pagination, timezone boundaries, and rollback.
- Keep deployment separate from Android APK workflow.

## Acceptance evidence required
Authorized Uber access, successful real API response, verified unique trip keys, reconciliation of at least one actual earnings record, and end-to-end Chrome/Android totals remaining unchanged except for the explicitly approved reconciled addition.
