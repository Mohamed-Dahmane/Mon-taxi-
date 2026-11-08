# Uber staging isolation audit — 2026-11-08

Status: **BLOCKED FOR PRODUCTION INGESTION**. Read-only inspection of Supabase `mon-taxi-v11` schema on 2026-11-08. No real Uber earnings have been ingested.

## Concrete finding
`public.taxi_uber_driver_earnings_staging` has `source`, `external_payment_id`, `driver_external_id`, timestamps, amounts, status, and raw_payload, **but no `user_id` column**. Existing uniqueness on `(source, external_payment_id)` does not establish tenant ownership. Never expose this staging table directly to browser clients, nor treat `driver_external_id` as sufficient proof of authorization. Do not ingest payments until authenticated-user-to-authorized-driver ownership and RLS/server-only access have been audited.

`taxi_uber_payments` includes `user_id`, `payment_id`, `trip_id`, `amount_cents`, and `cash_collected_cents`. A unique `(user_id,payment_id)` constraint alone does not prevent a trip being counted twice if its upstream payment IDs differ, or an adjustment being counted as a new trip.

## Safe next implementation gates
1. Confirm fleet membership, official Fleet Supplier entitlement, permitted scopes, stable payment/trip IDs and whether the data represents trips, earnings, payouts, cash collections or adjustments. `partner.payments` is not proof of entitlement.
2. Inspect RLS policies, grants, existing constraints and source update semantics before any migration. If necessary, add a *new* authenticated user association to staging through a reviewed additive migration, preserving existing rows and backup; do not guess driver ownership from identifiers.
3. Implement an isolated server-side parser for authorized source payloads, strict EUR-cent parsing, Europe/Brussels service dates, status transitions and correction/reversal handling. Reject records missing an immutable external identifier.
4. Stage records without touching daily/monthly receipts. Test exact replay, same trip with multiple payment events, updated amounts, reversed events and cross-user isolation in a non-production transaction.
5. Compare against an official statement and obtain explicit adoption approval before writing to `Appli`. Preserve manual amounts, a restore point, and Chrome/Android parity.
6. If official API access is unavailable, accept only driver-authorized exports via the same staging/reconciliation gates.

## Observed state
On 2026-11-08: credentials=0, payments=0, staging=0, OAuth states=0. Edge function `taxi-uber-oauth` active v2. No automatic Uber synchronization established. No production schema, receipts, or APK workflow changed by this audit.
