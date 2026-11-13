// Offline-only guardrails for future authorized Uber Fleet imports.
// This module does not access Supabase, Uber, or application revenue data.
function validISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}
export function validateFleetEarning(row, expectedDriverId) {
  if (!expectedDriverId || typeof expectedDriverId !== 'string') throw new Error('Verified driver identity required');
  if (!row || row.driver_external_id !== expectedDriverId) throw new Error('Driver mismatch');
  if (typeof row.source !== 'string' || !['uber_fleet', 'uber_official_export'].includes(row.source)) throw new Error('Unapproved source');
  if (typeof row.external_payment_id !== 'string' || !row.external_payment_id.trim() || row.external_payment_id !== row.external_payment_id.trim()) throw new Error('Payment ID required');
  if (row.currency !== 'EUR') throw new Error('Unsupported currency');
  for (const key of ['gross_cents','fee_cents','net_cents']) {
    if (!Number.isSafeInteger(row[key])) throw new Error('Invalid integer cents: ' + key);
  }
  if (row.gross_cents < 0 || row.fee_cents < 0 || row.net_cents < 0 || row.fee_cents > row.gross_cents) throw new Error('Invalid nonnegative payment amounts');
  if (row.gross_cents - row.fee_cents !== row.net_cents) throw new Error('Amounts do not reconcile');
  if (!validISODate(row.local_service_date)) throw new Error('Invalid service date');
  return Object.freeze({source:row.source,external_payment_id:row.external_payment_id,driver_external_id:row.driver_external_id,local_service_date:row.local_service_date,net_cents:row.net_cents});
}
export function deduplicateFleetEarnings(rows, expectedDriverId) {
  const seen = new Map();
  for (const raw of rows) {
    const row = validateFleetEarning(raw, expectedDriverId);
    const key = JSON.stringify([row.source,row.driver_external_id,row.external_payment_id]);
    if (seen.has(key)) {
      if (JSON.stringify(seen.get(key)) !== JSON.stringify(row)) throw new Error('Conflicting duplicate payment');
      continue;
    }
    seen.set(key,row);
  }
  return [...seen.values()];
}
