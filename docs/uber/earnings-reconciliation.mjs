// Offline, read-only normalization of authorized Uber earning events.
// No network, database writes or changes to the manual "Appli" field.
export function normalizeUberEarning(row) {
  if (!row || typeof row !== 'object') throw new Error('Missing row');
  const {source, driverId, eventId, tripId, eventType, amountCents, currency, occurredAt} = row;
  if (source !== 'uber-official') throw new Error('Unverified source');
  if (typeof driverId !== 'string' || !driverId.trim()) throw new Error('Missing driver');
  if (typeof eventId !== 'string' || !eventId.trim()) throw new Error('Missing stable event ID');
  if (typeof eventType !== 'string' || !eventType.trim()) throw new Error('Missing event type');
  if (tripId != null && (typeof tripId !== 'string' || !tripId.trim())) throw new Error('Invalid trip ID');
  if (!Number.isSafeInteger(amountCents)) throw new Error('Invalid cents');
  if (currency !== 'EUR') throw new Error('Unexpected currency');
  if (typeof occurredAt !== 'string' || !Number.isFinite(Date.parse(occurredAt)) ||
      !/(Z|[+-]\d{2}:\d{2})$/i.test(occurredAt)) throw new Error('Timestamp requires timezone');
  return Object.freeze({source, driverId:driverId.trim(), eventId:eventId.trim(),
    eventType:eventType.trim(), tripId:tripId?.trim() ?? null, amountCents, currency, occurredAt});
}
export function reconcileUberEarnings(rows, existingKeys = []) {
  const seen = new Set(existingKeys);
  const accepted = [];
  let duplicates = 0;
  for (const raw of rows) {
    const row = normalizeUberEarning(raw);
    // A trip can have multiple distinct earning, tip, adjustment or refund events.
    const key = JSON.stringify([row.source, row.driverId, row.eventId]);
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    accepted.push({...row, idempotencyKey:key, status:'pending_review'});
  }
  const totalCents = accepted.reduce((sum, row) => {
    const next = sum + row.amountCents;
    if (!Number.isSafeInteger(next)) throw new Error('Total cents overflow');
    return next;
  }, 0);
  return {accepted, duplicates, totalCents};
}
// All rows remain pending_review; a separate verified reconciliation is required
// before any data may influence "Appli". Never overwrite manual amounts.
