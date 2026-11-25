# Mon Taxi Pro — OAuth receipts candidate 2122 (not deployed)

Isolated groundwork, not a functioning OAuth service or APK. Contract validates exact scopes, fixed redirect, token responses and individually referenced successful EUR receipts. Never place the client secret in Android or GitHub. Existing SDK and deployed functions remain unchanged.

Before deployment: implement single-use expiring OAuth state bound to the initiating device, authenticated device pairing, encrypted server-side token storage and serialized refresh, merchant authorization, rate limits and redacted logging. Test callback, refresh and denial against a sandbox. Then expose an authenticated receipt endpoint and build a signed Android candidate.

Test: node tests/sumup-oauth-receipt-contract.mjs
