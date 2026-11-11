# Uber earnings: authorization and production gate (10 November 2026)

This is a **staging-only** integration. No Uber API authorization has been demonstrated and **no Uber amount may be written to Mon Taxi "Appli"** from this code.

## Authorized acquisition priority
1. **Independent driver account (confirmed by the account holder on 2026-11-11):** do not pursue Fleet Supplier as the default path. First verify whether Uber offers an officially approved API granting this individual driver's own earnings, with explicit scopes and consent. Existing `partner.payments` OAuth configuration is not evidence of such access.
2. **Official individual-driver exports** downloaded or supplied by the account holder (e.g. official earnings statements), with documented source, driver identity, export period and completeness. This is a batch import, not live synchronization; preview and deduplicate against existing entries.
3. **Uber Fleet Supplier** is conditional only if the account holder later confirms an actual authorized fleet relationship and Uber approves the relevant supplier access and scopes.
4. If no approved individual-driver API or usable official export is available, retain manual "Appli" entry. Do not scrape the driver app, intercept sessions, use undocumented endpoints or ask users to disclose tokens.

## Safe ingestion contract
- Backend only: keep OAuth credentials and refresh tokens in managed secrets; never ship them to Chrome/Android or commit them.
- Verify authenticated Mon Taxi user -> consenting individual Uber driver identity on the server for every batch; reject foreign drivers. Require fleet mapping only for a separately approved fleet integration.
- Use a stable source + driver + external event ID unique key and a separate driver + trip ID reconciliation guard; replay must be idempotent. Detect conflicting replays and overlapping Fleet/export batches rather than adding both.
- Store monetary values as integer EUR cents; use Europe/Brussels for service dates; preserve original timestamp and source evidence.
- Require complete source coverage for the requested day, including pagination and corrections. Unknown completeness is **not** zero revenue.
- Stage events, validate and preview them first. Preserve manual "Appli" as the authoritative amount. Do not overwrite, add or publish staged earnings automatically without separately approved reconciliation and rollback plan.
- Before any production migration: capture a verified recoverable backup, test restore, check row-level security, run duplicate/replay and Chrome/Android synchronization regression tests, and deploy behind a disabled-by-default feature flag.
- Do not run this pipeline from the existing APK surveillance workflow.

## Current verification
Read-only Supabase inspection on 2026-11-10: project `mon-taxi-v11` is active; `taxi_uber_credentials`, `taxi_uber_driver_earnings_staging`, `taxi_uber_payments` each contain zero rows; `taxi_management_backups` contains 1,346 rows. Presence of backup rows is **not** proof that a restore works. No verified Uber synchronization.

## Blocking evidence for live import
- Official Uber approval and scopes for individual-driver earnings (if such access is available), or a consented official individual-driver export with a stable driver identifier. Fleet-driver relationship is not applicable unless separately established.
- Verified representative event schema, paging/completeness semantics and handling of delayed adjustments.
- Successful end-to-end tests against a non-production environment, with evidence of exact reconciliation against Uber and preservation of existing manual entries.
