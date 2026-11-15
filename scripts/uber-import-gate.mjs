// Read-only reconciliation gate. Never writes to Supabase or to "Appli".
// A conflicting revision invalidates the original candidate as well as the revision.
import { inspectEvents } from './uber-reconcile-dryrun.mjs';

export function auditImportCandidates(events) {
  const result = inspectEvents(events);
  const blocked = new Set();
  const groups = new Map();
  for (const [index, event] of events.entries()) {
    if (!event || typeof event !== 'object' || event.eventType === 'payout') continue;
    if (!['trip','tip','adjustment','refund','fee'].includes(event.eventType)) continue;
    if (![event.source,event.fleetId,event.driverId,event.eventId].every(x=>typeof x==='string' && x.trim())) continue;
    const key = JSON.stringify([event.fleetId,event.driverId,event.eventType,event.eventId]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({index,source:event.source,currency:event.currency,amountMinor:event.amountMinor});
  }
  const holds=[];
  for (const [identity, items] of groups) {
    const sources=new Set(items.map(x=>x.source));
    const amounts=new Set(items.map(x=>JSON.stringify([x.currency,x.amountMinor])));
    if (sources.size > 1 || amounts.size > 1) {
      items.forEach(x=>blocked.add(x.index));
      holds.push({identity,indices:items.map(x=>x.index),reason:amounts.size>1?'conflicting_amounts':'multiple_sources',requiresManualReview:true});
    }
  }
  // No auto-import: accepted candidates are only suitable for further manual review.
  return {...result,acceptedForReview:result.accepted.filter(x=>!blocked.has(x.index)),holds,writesPerformed:0};
}
