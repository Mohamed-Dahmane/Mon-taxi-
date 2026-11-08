# Uber RLS verification — 2026-11-08 19:12 Europe/Brussels

Read-only SQL inspection of Supabase project `mon-taxi-v11` (`uenyvsiturkihectolxp`). This note is isolated on the feature branch; it does not modify production data or deployments.

## Verified policies (public tables only)

- `taxi_uber_credentials`: RLS enabled, **no policies**.
- `taxi_uber_oauth_states`: RLS enabled, **no policies**.
- `taxi_uber_driver_earnings_staging`: RLS enabled, **no policies**.
- `taxi_uber_payments`: RLS enabled, one SELECT policy for role `authenticated` with `auth.uid() = user_id`; no INSERT/UPDATE/DELETE policies.

These findings mean ordinary browser roles have no RLS-policy-based access to credentials, OAuth states or staging, and authenticated users can select only their own payments via the specified policy. **This is not proof that privileged service-role functions, grants, views, SECURITY DEFINER routines or other bypasses are safe.** The staging table still lacks a user_id, so authorized driver ownership must be established server-side before ingesting data.

## Safe implementation decision

Do **not** create a permissive staging SELECT policy or publish raw Uber payloads to clients. Keep ingestion behind authenticated server-side code, verify the authorized user's driver/fleet mapping, and store a stable source event ID plus trip ID. Deduplicate exact events and separately handle adjustments/reversals; never infer trip uniqueness solely from payment ID. Do not touch the `Appli` totals until reconciliation is independently verified.

## Follow-up verification gates

1. Inspect effective grants and SECURITY DEFINER routines before any production migration.
2. Confirm Uber Fleet Supplier eligibility and official read permissions; `partner.payments` alone does not establish entitlement.
3. In a disposable transaction, test cross-user access, exact replay, duplicate trip events and reversals.
4. If API access is denied, accept only explicitly authorized driver exports, staged and reconciled without changing manually entered receipts.

No earnings synchronization or real Uber ingestion is claimed by this note.
