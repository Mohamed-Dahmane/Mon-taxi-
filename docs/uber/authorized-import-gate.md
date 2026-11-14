# Uber individual earnings — authorized integration gate

Status: **OFFLINE PREVIEW ONLY**. This document does not authorize production writes.

## Official access prerequisites
1. Confirm whether the individual driver is associated with an Uber fleet account and whether the fleet administrator can authorize access to that driver's earnings. Fleet Supplier access is conditional on Uber approval and scopes; do not assume an endpoint or scope is granted.
2. Obtain official Uber documentation, approved application credentials, permitted scopes and a driver-to-fleet mapping. Keep tokens only in server-side secrets; never place them in GitHub commits, APK, browser local storage or logs.
3. If API access is denied, obtain an official driver earnings statement/export through an authorized user action. A manually supplied CSV/PDF can be parsed in a separate, review-only workflow. Do not scrape the Uber Driver app or bypass login/anti-bot protections.

## Safe import acceptance checklist
- Validate source provenance and authorization before labeling any event `uber-official`.
- Use stable idempotency keys (source, driver, event), not trip ID alone: fares, tips and adjustments may share a trip.
- Quarantine duplicate IDs with conflicting payloads; maintain an auditable ledger and never auto-replace earlier entries.
- Preserve UTC instants, then group by Europe/Brussels calendar day (DST included).
- Separate driver IDs, check EUR and integer cents, and reconcile refunds/negative adjustments.
- Compare with the current manual `Appli` amount and present differences for explicit review. **Never add imported earnings to existing manual entries automatically** or silently overwrite them.
- Require backup verification and a restore rehearsal before any production data migration or write path.
- Run tests and review a dry-run report against actual authorized Uber data before enabling a scheduler.
- Keep Chrome/Android data contract and existing sync untouched until a separate reviewed rollout.

## Current block
No Uber authorization or imported earnings are recorded in the connected Supabase tables at the time of inspection (2026-11-11). Offline unit tests do not establish real-time synchronization.
