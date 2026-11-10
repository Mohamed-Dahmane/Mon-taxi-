# Uber earnings: authorization and production gate (10 November 2026)

This is a **staging-only** integration. No Uber API authorization has been demonstrated and **no Uber amount may be written to Mon Taxi "Appli"** from this code.

## Authorized acquisition priority
1. **Uber Fleet Supplier** only after Uber approves the relevant fleet/supplier access, the driver belongs to the authorized fleet, and server-side credentials/scopes are verified. Do not assume driver account OAuth grants Fleet Supplier access.
2. **Official driver/fleet exports** explicitly downloaded or supplied by the account holder, with documented source, driver identity, export period and completeness. This is a batch import, not live synchronization.
3. If neither is available, retain manual "Appli" entry. Do not scrape the driver app, intercept sessions, use undocumented endpoints or ask users to disclose tokens.

## Safe ingestion contract
- Backend only: keep OAuth credentials and refresh tokens in managed secrets; never ship them to Chrome/Android or commit them.
- Verify authenticated Mon Taxi user -> approved fleet -> authorized driver mapping on the server for every batch. Reject foreign drivers.
- Use a stable source + driver + external event ID unique key and a separate driver + trip ID reconciliation guard; replay must be idempotent. Detect conflicting replays and overlapping Fleet/export batches rather than adding both.
- Store monetary values as integer EUR cents; use Europe/Brussels for service dates; preserve original timestamp and source evidence.
- Require complete source coverage for the requested day, including pagination and corrections. Unknown completeness is **not** zero revenue.
- Stage events, validate and preview them first. Preserve manual "Appli" as the authoritative amount. Do not overwrite, add or publish staged earnings automatically without separately approved reconciliation and rollback plan.
- Before any production migration: capture a verified recoverable backup, test restore, check row-level security, run duplicate/replay and Chrome/Android synchronization regression tests, and deploy behind a disabled-by-default feature flag.
- Do not run this pipeline from the existing APK surveillance workflow.

## Current verification
Read-only Supabase inspection on 2026-11-10: project `mon-taxi-v11` is active; `taxi_uber_credentials`, `taxi_uber_driver_earnings_staging`, `taxi_uber_payments` each contain zero rows; `taxi_management_backups` contains 1,346 rows. Presence of backup rows is **not** proof that a restore works. No verified Uber synchronization.

## Blocking evidence for live import
- Official Uber API approval, scopes and fleet-driver relationship (or a consented official export with a stable driver identifier).
- Verified representative event schema, paging/completeness semantics and handling of delayed adjustments.
- Successful end-to-end tests against a non-production environment, with evidence of exact reconciliation against Uber and preservation of existing manual entries.
