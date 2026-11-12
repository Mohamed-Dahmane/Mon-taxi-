# Uber OAuth / Fleet Supplier — production gate audit (2026-11-12)

Read-only inspection of deployed Supabase Edge Function `taxi-uber-oauth` v2 and staging tables.

- The deployed function's `/start` endpoint requires a valid Mon Taxi bearer session and generates a hashed, expiring OAuth state. The `/callback` endpoint exchanges the code server-side and encrypts credentials before storing them.
- **Important distinction:** this function requests and verifies `partner.payments`, not a confirmed Fleet Supplier earnings permission. Deployment of OAuth does **not** prove Uber granted individual driver payment access.
- The function's `/health` response reports whether three environment variables are present, **not** whether an Uber authorization exists or a payment endpoint works. Do not present it as a successful sync.
- `verify_jwt=false` at the Edge Function gateway; `/start` performs its own user-token check. The public callback uses the OAuth state. Preserve this design only after a dedicated security review; never expose the service-role key or encrypted token payload.
- No scheduler, payment-fetch implementation, or production `Appli` write is verified by this audit.

Before enabling imports:
1. Obtain Uber's official confirmation of Fleet Supplier eligibility, approved scopes/endpoints, fleet-to-driver mapping and permitted payment granularity. Do not guess API paths or grant names.
2. Test one authorized driver with redacted sample data in an isolated dry run; reconcile event IDs including tips, refunds and adjustments.
3. Keep `Appli` manual entries unchanged until an explicit reviewed migration, a verified backup and restoration rehearsal. Never sum the same earnings twice.
4. If Fleet Supplier is unavailable, accept a user-supplied official Uber earnings export for **preview only**. No credential scraping, automated Driver-app browsing or bypassing anti-bot controls.

This document changes no Supabase objects, APK workflow, Chrome/Android sync, or financial records.
