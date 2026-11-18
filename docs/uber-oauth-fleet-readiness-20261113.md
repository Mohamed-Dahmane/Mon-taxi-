# Uber OAuth / Fleet readiness — 2026-11-13

This is a **read-only operational assessment**, not proof of an Uber integration.

## Verified against Supabase project mon-taxi-v11
- Edge Function `taxi-uber-oauth` is deployed (version 2); `verify_jwt=false` because its callback must accept Uber's unauthenticated redirect. Its `/start` handler explicitly verifies a Mon Taxi bearer session via `admin.auth.getUser`.
- The OAuth implementation requests `partner.payments` and checks that Uber actually granted it before storing encrypted tokens. It uses a hashed random state with a 10-minute expiry.
- On 2026-11-13, the following production tables each contained **zero rows**: `taxi_uber_payments`, `taxi_uber_driver_earnings_staging`, `taxi_uber_credentials`, `taxi_uber_oauth_states`.
- No evidence of a granted Uber Fleet Supplier permission, linked driver identity, fetched earnings or synchronized `Appli` entries.

## Required before any automatic posting
1. Confirm whether this account is a fleet supplier, and obtain Uber's **official** approval for the relevant payments/earnings scope; `partner.payments` in source code does not establish approval.
2. Verify Uber driver ID ↔ authenticated Mon Taxi user mapping with a documented provenance.
3. In a staging environment, verify a full OAuth callback and token refresh without exposing token material to browser logs.
4. Use a database-enforced unique key scoped to the authoritative Uber payment/trip identifier **and** driver; use an atomic transaction for deduplication, reconciliation and daily `Appli` posting. Test replay, cross-source duplicates, refunds and corrections.
5. Take and verify a restorable production data backup before any migration. Preserve manual `Appli` amounts and Chrome/Android sync semantics.
6. Prefer a reviewed, read-only import of Uber's official statements when API permission is unavailable; never scrape driver credentials.

## Current decision
**Do not enable production ingestion or write into `Appli`.** No production data, secrets, Edge Functions, APK workflows or browser synchronization are changed by this document.
