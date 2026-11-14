// Offline preflight only. Never writes to Uber, Supabase or Mon Taxi.
// Existing entries must come from a trusted, complete snapshot of persisted Uber payments.
export function reconcileWithPersistedPayments(incoming, persisted) {
  if (!Array.isArray(incoming) || !Array.isArray(persisted)) throw new Error('Complete persisted snapshot required');
  const key = row => {
    if (!row || typeof row.driver_external_id !== 'string' || !row.driver_external_id.trim() || row.driver_external_id !== row.driver_external_id.trim() ||
        typeof row.external_payment_id !== 'string' || !row.external_payment_id.trim() || row.external_payment_id !== row.external_payment_id.trim() ||
        !['uber_fleet','uber_official_export'].includes(row.source) ||
        !Number.isSafeInteger(row.net_cents) || row.net_cents < 0 ||
        typeof row.local_service_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.local_service_date) ||
        !Number.isFinite(Date.parse(row.local_service_date + 'T00:00:00Z')) ||
        new Date(row.local_service_date + 'T00:00:00Z').toISOString().slice(0,10) !== row.local_service_date) {
      throw new Error('Unverifiable payment identity or amount');
    }
    return JSON.stringify([row.driver_external_id,row.external_payment_id]);
  };
  const old = new Map();
  for (const row of persisted) {
    const k=key(row);
    if (old.has(k)) throw new Error('Persisted payment collision; manual review required');
    old.set(k,row);
  }
  const accepted=[]; const seen=new Map();
  for (const row of incoming) {
    const k=key(row);
    if (seen.has(k)) throw new Error('Incoming payment collision; reconcile batch first');
    seen.set(k,row);
    const prior=old.get(k);
    if (!prior) {accepted.push(row);continue;}
    if (prior.source!==row.source || prior.net_cents!==row.net_cents || prior.local_service_date!==row.local_service_date) {
      throw new Error('Persisted payment conflict; manual review required');
    }
  }
  return Object.freeze({newPayments:Object.freeze(accepted),alreadyPresent:incoming.length-accepted.length});
}
