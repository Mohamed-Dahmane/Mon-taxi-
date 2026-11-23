/** Read-only cross-batch reconciliation. Never writes to Appli or Supabase. */
import { stageVerifiedDriverPayments } from './uber-driver-reconciliation-gate.js';

/**
 * Compare an official Fleet payment page against previously staged records.
 * Fail closed on any changed payment_id, driver, or payment contents.
 * A server-verified driver ID is mandatory, not a client-provided selector.
 */
export function reconcileFleetPaymentPage(incoming, existing, { verifiedDriverId } = {}) {
  if (!Array.isArray(existing)) throw new Error('Expected existing staging array');
  const fresh = stageVerifiedDriverPayments(incoming, { verifiedDriverId });
  const byId = new Map();
  for (const old of existing) {
    if (!old || old.source !== 'uber' || typeof old.externalId !== 'string' ||
        !old.externalId.trim() || old.verifiedDriverId !== verifiedDriverId ||
        old.status !== 'staging_only') throw new Error('Invalid existing staging record');
    if (byId.has(old.externalId)) throw new Error('Duplicate existing payment id');
    byId.set(old.externalId, old);
  }
  const inserted = [];
  const unchanged = [];
  for (const item of fresh) {
    const previous = byId.get(item.externalId);
    if (!previous) { inserted.push(item); continue; }
    // Compare only canonical financial and identity fields; reject discrepancies.
    const keys = ['source','externalId','timestamp','amountCents','cashCollectedCents',
      'currency','category','tripId','verifiedDriverId','status'];
    if (keys.some(key => previous[key] !== item[key]))
      throw new Error('Conflicting staged Uber payment: ' + item.externalId);
    unchanged.push(item.externalId);
  }
  return { inserted, unchanged, conflicts: 0, writeToAppli: false };
}
