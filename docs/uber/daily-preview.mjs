// Offline-only preview of authorized Uber events. Does not write to Supabase or "Appli".
import { reconcileUberEarnings } from './earnings-reconciliation.mjs';
const dayFormatter = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'});
export function previewUberDays(rows, existingKeys = []) {
  const reconciliation = reconcileUberEarnings(rows, existingKeys);
  const days = new Map();
  for (const event of reconciliation.accepted) {
    // Format via parts, independent of Node/browser locale formatting.
    const parts = Object.fromEntries(dayFormatter.formatToParts(new Date(event.occurredAt))
      .filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    const key = JSON.stringify([event.driverId, day]);
    const prior = days.get(key) ?? {driverId:event.driverId, day, currency:'EUR', totalCents:0, eventCount:0, status:'pending_review'};
    const totalCents = prior.totalCents + event.amountCents;
    if (!Number.isSafeInteger(totalCents)) throw new Error('Daily cents overflow');
    days.set(key, {...prior, totalCents, eventCount:prior.eventCount+1});
  }
  return {days:[...days.values()].sort((a,b)=>a.day.localeCompare(b.day)||a.driverId.localeCompare(b.driverId)),
    duplicates:reconciliation.duplicates, conflicts:reconciliation.conflicts,
    // No amount is approved for production, even when the preview is conflict-free.
    status:'preview_only'};
}
