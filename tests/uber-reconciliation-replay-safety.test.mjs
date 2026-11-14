import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileWithPersistedPayments as reconcile } from '../lib/uber-persistent-reconciliation.mjs';

const payment = Object.freeze({
  source: 'uber_fleet',
  driver_external_id: 'driver-1',
  external_payment_id: 'payment-1',
  net_cents: 1234,
  local_service_date: '2026-11-13',
});

test('a replayed complete batch is a no-op', () => {
  const result = reconcile([payment], [payment]);
  assert.deepEqual(result.newPayments, []);
  assert.equal(result.alreadyPresent, 1);
});

test('a conflicting historical row fails the entire batch instead of partially accepting it', () => {
  const fresh = { ...payment, external_payment_id: 'payment-2' };
  const changed = { ...payment, net_cents: 9999 };
  assert.throws(() => reconcile([fresh, changed], [payment]), /conflict/);
});

test('an invalid persisted amount prevents importing a new payment', () => {
  const fresh = { ...payment, external_payment_id: 'payment-2' };
  assert.throws(() => reconcile([fresh], [{ ...payment, net_cents: Number.NaN }]), /Unverifiable/);
});

test('the offline reconciler never mutates its input rows or arrays', () => {
  const incoming = Object.freeze([Object.freeze({ ...payment, external_payment_id: 'payment-2' })]);
  const persisted = Object.freeze([payment]);
  assert.equal(reconcile(incoming, persisted).newPayments.length, 1);
  assert.equal(incoming.length, 1);
  assert.equal(persisted.length, 1);
});
