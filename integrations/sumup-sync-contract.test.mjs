// Offline regression checks for the private SumUp sync contract.
// No credentials, network access, or production transactions are used.
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
const source = readFileSync(new URL('../supabase/functions/taxi-sumup-sync/index.ts', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/sumup-sync.yml', import.meta.url), 'utf8');
const requireMatch = (text, pattern, label) => assert.match(text, pattern, label);
requireMatch(source, /req\.method\s*!==\s*"POST"/, 'Only POST may invoke sync');
requireMatch(source, /origin\.hostname\s*!==\s*"uenyvsiturkihectolxp\.supabase\.co"/, 'Fixed project origin required');
requireMatch(source, /claims\.role\s*!==\s*"service_role"/, 'Service-role authorization required');
requireMatch(source, /redirect:\s*"error"/g, 'Redirects must be rejected for credentialed fetches');
requireMatch(source, /seenTransactionIds\.has\(tx\.id\)/, 'Duplicate pagination detection required');
requireMatch(source, /if\(!reachedEnd\)\s*return/, 'Incomplete pagination must not write');
requireMatch(source, /if\(pendingRows\.length\)\s*\{[\s\S]*?\.upsert\(pendingRows,\s*\{onConflict:"transaction_id"\}\)/, 'Single staged database write required');
assert.ok(source.indexOf('if(!reachedEnd)') < source.indexOf('.upsert(pendingRows'), 'Pagination must finish before writing');
requireMatch(workflow, /permissions:\s*\n\s*contents:\s*read/, 'Workflow token must be read-only');
requireMatch(workflow, /cancel-in-progress:\s*false/, 'Overlapping sync must not cancel active writes');
requireMatch(workflow, /secrets\.SUMUP_API_KEY/, 'API key must be a GitHub secret');
requireMatch(workflow, /secrets\.SUPABASE_SERVICE_ROLE_KEY/, 'Service-role key must be a GitHub secret');
assert.doesNotMatch(workflow, /\bset\s+-x\b|\bcurl\s+[^\n]*--verbose\b/, 'Do not enable verbose credential logging');
// Guard financial data validation and prevent partial-history writes.
requireMatch(source, /!Array\.isArray\(entries\)/, 'Unknown API responses must fail closed');
requireMatch(source, /entries\.length>100/, 'Oversized pagination pages must be rejected');
requireMatch(source, /invalid_sumup_currency/, 'Malformed currencies must not be silently discarded');
requireMatch(source, /!Number\.isSafeInteger\(cents\)\|\|cents<0/, 'Amounts must be nonnegative safe integer cents');
requireMatch(source, /timeZone:"Europe\/Brussels"/, 'Daily grouping must use Brussels local time');
requireMatch(source, /pagination_limit_reached/, 'Pagination exhaustion must fail closed');
requireMatch(source, /No transaction details returned/, 'Success response must not contain payment details');
requireMatch(workflow, /response intentionally not printed/, 'Failed sync response must not be logged');
requireMatch(workflow, /processed counts examined EUR rows/, 'Processed count must not be described as new payments');
// Ensure credentialed HTTP requests remain bounded and cannot follow redirects.
requireMatch(source, /endpoint=new URL\("https:\/\/api\.sumup\.com\/v0\.1\/me\/transactions\/history"\)/, 'SumUp API must use the fixed HTTPS endpoint');
requireMatch(source, /signal:AbortSignal\.timeout\(20000\),redirect:"error"/, 'SumUp requests must time out and reject redirects');
requireMatch(source, /signal:AbortSignal\.timeout\(10000\),redirect:"error"/, 'Supabase verification must time out and reject redirects');
requireMatch(workflow, /--proto '=https' --tlsv1\.2/, 'Workflow must require HTTPS and TLS 1.2+');
requireMatch(workflow, /--max-filesize 16384 --max-time 90 --connect-timeout 15/, 'Workflow HTTP calls must be bounded');
requireMatch(workflow, /timeout-minutes:\s*8/, 'Workflow must have a job timeout');
requireMatch(workflow, /umask 077/, 'Temporary response files must be private');
requireMatch(workflow, /trap 'rm -f response\.json' EXIT/, 'Temporary response files must be removed');

// Prevent accidental widening of the financial import window or disclosure of sensitive payloads.
requireMatch(source, /const START = Date\.parse\("2026-10-31T23:00:00Z"\)/, 'Import start must remain fixed at Brussels November midnight');
requireMatch(source, /endpoint\.searchParams\.set\("oldest_time","2026-10-31T23:00:00Z"\)/, 'SumUp query must use the same import boundary');
requireMatch(source, /return Response\.json\(\{ok:true,processed:count,window_start:"2026-11-01",note:"No transaction details returned"\}\)/, 'Success must return only safe summary fields');
assert.doesNotMatch(source, /console\.(?:log|debug|info|warn|error)\s*\(/, 'Edge Function must not log transaction or credential data');
assert.doesNotMatch(workflow, /\becho\s+["']?\$\{?(?:SUMUP_API_KEY|SUPABASE_SERVICE_ROLE_KEY)\}?/, 'Workflow must not echo private credentials');
console.log('Private SumUp sync contract checks passed (offline; no live sync verified).');
