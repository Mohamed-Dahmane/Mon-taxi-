/** Read-only, all-or-nothing reconciliation of multiple official Uber Fleet pages.
 * No database writes, no cursor persistence and no Appli mutations.
 * The caller must obtain verifiedDriverId from server-side authorization.
 */
import { reconcileFleetPaymentPage } from './uber-fleet-page-reconciliation.js';

export function reconcileFleetPaymentPages(pages, existing, { verifiedDriverId } = {}) {
  if (!Array.isArray(pages) || !pages.every(Array.isArray))
    throw new Error('Expected an array of payment pages');
  if (!Array.isArray(existing)) throw new Error('Expected existing staging array');
  // All results remain in memory until every page has passed validation.
  let staged = [...existing];
  const insertedById = new Map();
  const unchanged = new Set();
  for (const page of pages) {
    const result = reconcileFleetPaymentPage(page, staged, { verifiedDriverId });
    for (const id of result.unchanged) if (!insertedById.has(id)) unchanged.add(id);
    for (const payment of result.inserted) {
      staged.push(payment);
      insertedById.set(payment.externalId, payment);
    }
  }
  return {
    inserted: [...insertedById.values()],
    unchanged: [...unchanged],
    writeToAppli: false,
    commitAllowed: false,
    processedPages: pages.length
  };
}
