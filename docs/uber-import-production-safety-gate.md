# Uber earnings import: production safety gate (design only)

Status: **NOT CONNECTED**. This document does not authorize writes to Supabase or to the Mon Taxi "Appli" field.

## Required evidence before enabling
1. Verify the Uber Fleet Supplier permission actually grants the fleet access to this individual driver's earnings. The existing `partner.payments` scope alone is not proof of Fleet Supplier access. Do not collect or log access tokens.
2. Verify the authenticated Mon Taxi user and the Uber driver identifier with an official source; reject other drivers.
3. Record a restorable backup of the current application data, with an independently verified restore procedure, before enabling any writes. Existing backup rows are not evidence of a newly verified restore point.
4. Run the offline reconciliation tests and record a successful CI result.
5. Reconcile one official statement in **read-only dry-run mode**, including dates, refunds, fees, cash-collected rides and timezone Europe/Brussels. Do not assume that a payment row equals a trip or that gross minus fees is always the correct "Appli" amount.
6. Keep the existing Chrome/Android synchronization path untouched; use the same application data model and user ownership constraints only after the dry run is approved.

## Idempotency across batches
`deduplicateFleetEarnings` protects **one batch only**. It does NOT prevent the same payment from being inserted in a later batch or from another source. Before production writes, use a database-enforced canonical payment identity and atomic upsert/reconciliation, scoped to the verified driver and user. A source-specific unique index alone cannot prevent a Fleet/export double count. Ambiguous matches must remain pending manual reconciliation, never automatically credited.

## Safe fallback
If Uber does not grant the necessary Fleet Supplier access, use a user-supplied official Uber earnings export with explicit user authorization. Parse and preview it locally, require manual confirmation, and apply the same persistent idempotency and cash/refund checks. Never scrape the Driver app, reuse private session cookies, or bypass OAuth approval.

## Current production boundary
The tables `taxi_uber_driver_earnings_staging`, `taxi_uber_payments`, `taxi_uber_credentials`, `taxi_uber_oauth_states`, and `taxi_management_backups` exist in Supabase `mon-taxi-v11`. This note intentionally makes **no schema changes, no data writes and no deployment**.
