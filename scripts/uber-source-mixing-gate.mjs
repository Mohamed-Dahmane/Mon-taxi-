// Conservative source-mixing gate for pre-import review only.
// Different event IDs across Fleet and statements cannot establish distinct trips.
// Never writes to Supabase, Chrome/Android storage, or "Appli".
import { auditImportCandidates } from './uber-import-gate.mjs';

export function auditSourceMixing(events) {
  const audit = auditImportCandidates(events);
  const byDriver = new Map();
  for (const [index, event] of events.entries()) {
    if (!event || typeof event !== 'object') continue;
    if (!['trip','tip','adjustment','refund','fee'].includes(event.eventType)) continue;
    if (![event.fleetId,event.driverId,event.source].every(v => typeof v === 'string' && v.trim())) continue;
    const key = JSON.stringify([event.fleetId,event.driverId]);
    if (!byDriver.has(key)) byDriver.set(key, new Map());
    const sources = byDriver.get(key);
    if (!sources.has(event.source)) sources.set(event.source, []);
    sources.get(event.source).push(index);
  }
  const mixedDrivers = [];
  const blocked = new Set();
  for (const [driver, sources] of byDriver) {
    if (sources.size < 2) continue;
    const indices = [...sources.values()].flat().sort((a,b) => a-b);
    indices.forEach(i => blocked.add(i));
    mixedDrivers.push({driver, sources:[...sources.keys()].sort(), indices, reason:'unverified_cross_source_event_ids', requiresManualReview:true});
  }
  const safe = audit.acceptedForReview.filter(item => !blocked.has(item.index));
  // Keep every candidate-facing field consistent: never expose held events via `accepted`.
  return {...audit, accepted:safe, acceptedForReview:safe, mixedDrivers, writesPerformed:0};
}
