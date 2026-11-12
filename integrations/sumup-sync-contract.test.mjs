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
console.log('Private SumUp sync contract checks passed (offline; no live sync verified).');
