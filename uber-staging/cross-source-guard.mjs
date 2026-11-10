// Staging-only cross-source reconciliation guard. Never writes to Supabase or Mon Taxi.
// Call only with verified driver IDs and stable Uber trip IDs. Missing IDs are rejected.
export function reconcileUberTrips(events) {
  if (!Array.isArray(events)) throw new TypeError('events must be an array');
  const byTrip = new Map();
  const accepted = [];
  for (const event of events) {
    if (!event || typeof event.driverId !== 'string' || !event.driverId.trim() ||
        typeof event.tripId !== 'string' || !event.tripId.trim() ||
        typeof event.source !== 'string' || !event.source.trim() ||
        typeof event.eventId !== 'string' || !event.eventId.trim() ||
        !Number.isSafeInteger(event.amountCents)) {
      throw new Error('Incomplete Uber event: driver, trip, source, event and integer cents required');
    }
    const key = JSON.stringify([event.driverId, event.tripId]);
    const previous = byTrip.get(key);
    if (previous) {
      if (previous.source !== event.source) throw new Error('Cross-source Uber trip overlap: manual reconciliation required');
      if (previous.eventId !== event.eventId || previous.amountCents !== event.amountCents) {
        throw new Error('Conflicting Uber trip replay: manual reconciliation required');
      }
      continue; // exact replay: idempotent
    }
    byTrip.set(key, event);
    accepted.push(event);
  }
  return accepted;
}
