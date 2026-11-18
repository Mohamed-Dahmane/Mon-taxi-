// Offline, read-only Uber event reconciliation. No Supabase writes or credentials.
// Usage: node scripts/uber-reconcile-dryrun.mjs events.json
import { readFileSync } from 'node:fs';

export function inspectEvents(events) {
  if (!Array.isArray(events)) throw new Error('Expected an array');
  const seen = new Map();
  const accepted = [], duplicates = [], quarantined = [], excluded = [];
  for (const [index, event] of events.entries()) {
    if (!event || typeof event !== 'object') { quarantined.push({ index, reason: 'invalid_event' }); continue; }
    const { source, fleetId, driverId, eventId, eventType, currency, amountMinor } = event;
    if (![source, fleetId, driverId, eventId, eventType, currency].every(x => typeof x === 'string' && x.trim()) ||
        !Number.isSafeInteger(amountMinor) || !/^[A-Z]{3}$/.test(currency)) {
      quarantined.push({ index, reason: 'missing_or_invalid_fields' }); continue;
    }
    if (eventType === 'payout') { excluded.push({ index, reason: 'payout_not_income' }); continue; }
    if (!['trip', 'tip', 'adjustment', 'refund', 'fee'].includes(eventType)) {
      quarantined.push({ index, reason: 'unknown_event_type' }); continue;
    }
    // Do not conflate two drivers or two event categories.
    const key = JSON.stringify([source, fleetId, driverId, eventType, eventId]);
    const signature = JSON.stringify([currency, amountMinor]);
    if (seen.has(key)) {
      if (seen.get(key) === signature) duplicates.push({ index, reason: 'replayed_event' });
      else quarantined.push({ index, reason: 'conflicting_revision_requires_review' });
      continue;
    }
    seen.set(key, signature);
    accepted.push({ index, key, driverId, eventType, currency, amountMinor });
  }
  return { accepted, duplicates, quarantined, excluded, writesPerformed: 0 };
}

if (process.argv[1]?.endsWith('uber-reconcile-dryrun.mjs')) {
  const path = process.argv[2];
  if (!path) { console.error('Usage: node scripts/uber-reconcile-dryrun.mjs events.json'); process.exitCode = 2; }
  else {
    try {
      const report = inspectEvents(JSON.parse(readFileSync(path, 'utf8')));
      console.log(JSON.stringify(report, null, 2));
      if (report.quarantined.length) process.exitCode = 1;
    } catch (err) { console.error(err.message); process.exitCode = 2; }
  }
}
