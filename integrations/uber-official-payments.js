/**
 * Convert official Uber GET /v1/partners/payments items to stable Mon Taxi records.
 * No network access or credentials. Do not merge with the live "Appli" amount
 * until OAuth partner.payments and reconciliation are verified.
 * Official response fields: payment_id, event_time (Unix seconds), amount,
 * currency_code, category, cash_collected, trip_id.
 */
export function normalizeUberApiPayment(payment) {
  if (!payment || typeof payment !== 'object') throw new Error('Invalid payment');
  const externalId = String(payment.payment_id ?? '').trim();
  const seconds = Number(payment.event_time);
  const amount = Number(payment.amount);
  const currency = String(payment.currency_code ?? '').toUpperCase();
  if (!externalId || !Number.isFinite(seconds) || seconds <= 0 ||
      !Number.isFinite(new Date(seconds * 1000).getTime())) throw new Error('Invalid payment id or event time');
  if (currency !== 'EUR' || !Number.isFinite(amount)) throw new Error('Invalid payment amount or currency');
  const amountCents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - amountCents) > 0.000001) throw new Error('Amount must have two decimals');
  const cashCollected = Number(payment.cash_collected ?? 0);
  if (!Number.isFinite(cashCollected) || cashCollected < 0) throw new Error('Invalid cash collected');
  const cashCollectedCents = Math.round(cashCollected * 100);
  if (Math.abs(cashCollected * 100 - cashCollectedCents) > 0.000001) throw new Error('Invalid cash precision');
  return {
    source: 'uber',
    externalId,
    timestamp: new Date(seconds * 1000).toISOString(),
    amountCents, // signed net payout: Uber may report deductions
    cashCollectedCents, // separate from net payout to avoid double counting
    currency: 'EUR',
    category: String(payment.category ?? ''),
    tripId: payment.trip_id == null ? null : String(payment.trip_id)
  };
}

export function uniqueUberApiPayments(payments) {
  if (!Array.isArray(payments)) throw new Error('Expected payments array');
  const seen = new Map();
  for (const payment of payments) {
    const item = normalizeUberApiPayment(payment);
    const previous = seen.get(item.externalId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(item))
      throw new Error('Conflicting payment_id: ' + item.externalId);
    seen.set(item.externalId, item);
  }
  return [...seen.values()];
}
