// Read-only cross-source collision audit. Does not authorize automatic import.
// Matching IDs across sources are candidates, not proof of the same trip.
import { inspectEvents } from './uber-reconcile-dryrun.mjs';
export function auditCrossSource(events) {
  const result = inspectEvents(events);
  const groups = new Map();
  for (const item of result.accepted) {
    const original = events[item.index];
    if (!['trip','tip','adjustment','refund','fee'].includes(original.eventType)) continue;
    const identity = JSON.stringify([original.fleetId,original.driverId,original.eventType,original.eventId]);
    if (!groups.has(identity)) groups.set(identity,[]);
    groups.get(identity).push({index:item.index,source:original.source,currency:item.currency,amountMinor:item.amountMinor});
  }
  const collisions = [];
  const blocked = new Set();
  for (const [identity,items] of groups) {
    if (new Set(items.map(x=>x.source)).size < 2) continue;
    const sameAmount = new Set(items.map(x=>JSON.stringify([x.currency,x.amountMinor]))).size === 1;
    collisions.push({identity,items,reason:sameAmount?'cross_source_possible_duplicate':'cross_source_amount_conflict',requiresManualReview:true});
    items.forEach(x=>blocked.add(x.index));
  }
  return {...result,acceptedForReview:result.accepted.filter(x=>!blocked.has(x.index)),crossSourceQuarantine:collisions,writesPerformed:0};
}
