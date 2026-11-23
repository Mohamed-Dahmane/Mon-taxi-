/**
 * Read-only reconciliation gate for individual Uber earnings.
 * This module does not write to Supabase or to Mon Taxi's "Appli" totals.
 * Only server-verified fleet driver IDs may be passed as verifiedDriverId.
 */
import { uniqueUberApiPayments } from './uber-official-payments.js';

export function stageVerifiedDriverPayments(payments, { verifiedDriverId, paymentDriverIdField = 'driver_id' } = {}) {
  if (typeof verifiedDriverId !== 'string' || !verifiedDriverId.trim())
    throw new Error('Verified driver identity required');
  if (!Array.isArray(payments)) throw new Error('Expected payments array');
  const driver = verifiedDriverId.trim();
  for (const p of payments) {
    if (!p || String(p[paymentDriverIdField] ?? '').trim() !== driver)
      throw new Error('Payment driver identity mismatch or absent');
  }
  return uniqueUberApiPayments(payments).map(p => ({
    ...p, verifiedDriverId: driver, status: 'staging_only'
  }));
}
