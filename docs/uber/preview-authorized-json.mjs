// Offline diagnostic only. Accepts a normalized, explicitly authorized JSON export.
// Never fetches Uber data, stores credentials, or writes to Supabase/Appli.
// Usage: node docs/uber/preview-authorized-json.mjs < authorized-events.json
import { readFileSync } from 'node:fs';
import { compareUberWithManual } from './manual-appli-comparison.mjs';

function main() {
  const raw = readFileSync(0, 'utf8');
  if (Buffer.byteLength(raw, 'utf8') > 5_000_000) throw new Error('Input too large');
  const input = JSON.parse(raw);
  if (!input || input.authorizedSource !== true ||
      !Array.isArray(input.events) || !Array.isArray(input.manualDays) ||
      !Array.isArray(input.existingKeys)) {
    throw new Error('Explicit authorization and events/manualDays/existingKeys arrays required');
  }
  const report = compareUberWithManual(input.events, input.manualDays, input.existingKeys);
  // Emit only aggregate counts; never echo raw event identifiers or personal data.
  const totals = report.comparisons.map(({day,totalCents,manualCents,differenceCents,status}) =>
    ({day,totalCents,manualCents,differenceCents,status}));
  process.stdout.write(JSON.stringify({
    status:'preview_only', dayCount:totals.length,
    duplicateCount:report.duplicates.length, conflictCount:report.conflicts.length,
    comparisons:totals
  }, null, 2) + '\n');
}
try { main(); } catch (error) {
  process.stderr.write('Offline preview rejected: ' + error.message + '\n');
  process.exitCode = 1;
}
