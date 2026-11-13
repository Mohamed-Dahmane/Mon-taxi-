import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUberApiPayment, uniqueUberApiPayments } from './uber-official-payments.js';

const sample = { payment_id: 'pay-1', event_time: 1794500000, amount: 12.34, currency_code: 'EUR', category: 'trip', trip_id: 'trip-1' };

test('replayed payment is counted once', () => {
  const result = uniqueUberApiPayments([sample, { ...sample }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].amountCents, 1234);
});

test('same payment id with changed amount blocks entire batch', () => {
  assert.throws(() => uniqueUberApiPayments([sample, { ...sample, amount: 99 }]), /Conflicting payment_id/);
});

test('cash collected stays separate from payout', () => {
  const result = normalizeUberApiPayment({ ...sample, cash_collected: 20 });
  assert.equal(result.cashCollectedCents, 2000);
  assert.equal(result.amountCents, 1234);
});

test('reject non-EUR, fractional cents and invalid event time', () => {
  assert.throws(() => normalizeUberApiPayment({ ...sample, currency_code: 'USD' }));
  assert.throws(() => normalizeUberApiPayment({ ...sample, amount: 1.234 }));
  assert.throws(() => normalizeUberApiPayment({ ...sample, event_time: 0 }));
});

test('signed adjustments remain signed and original payload is unchanged', () => {
  const original = { ...sample, amount: -2.5 };
  const before = JSON.stringify(original);
  assert.equal(normalizeUberApiPayment(original).amountCents, -250);
  assert.equal(JSON.stringify(original), before);
});
