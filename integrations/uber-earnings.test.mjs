import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUberEarning, deduplicateUberEarnings, sumUberEarningsCents } from './uber-earnings.js';

const a = { id: 'trip-1', timestamp: '2026-11-07T05:00:00Z', currency: 'EUR', amount: 12.34 };
test('normalizes euro amounts into cents', () => {
  assert.deepEqual(normalizeUberEarning(a), {
    source: 'uber', externalId: 'trip-1', timestamp: a.timestamp,
    currency: 'EUR', amountCents: 1234
  });
});
test('duplicate trips are counted once', () => {
  assert.equal(sumUberEarningsCents([a, a]), 1234);
  assert.equal(deduplicateUberEarnings([a, a]).length, 1);
});
test('different trips add correctly', () => {
  assert.equal(sumUberEarningsCents([a, { ...a, id: 'trip-2', amount: 7.66 }]), 2000);
});
test('rejects malformed, non-EUR, negative, and overly precise amounts', () => {
  for (const item of [
    { ...a, id: '' }, { ...a, timestamp: 'bad' }, { ...a, currency: 'USD' },
    { ...a, amount: -1 }, { ...a, amount: 1.001 }
  ]) assert.throws(() => normalizeUberEarning(item));
});
test('rejects conflicting records for the same trip', () => {
  assert.throws(() => deduplicateUberEarnings([a, { ...a, amount: 99 }]));
});
