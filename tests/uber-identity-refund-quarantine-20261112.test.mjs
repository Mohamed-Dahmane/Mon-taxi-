import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileUberEarnings} from '../docs/uber/earnings-reconciliation.mjs';

const fare = (overrides = {}) => ({
  source:'uber-official', driverId:'driver-1', eventId:'fare-1',
  tripId:'trip-1', eventType:'fare', amountCents:1200,
  currency:'EUR', occurredAt:'2026-11-12T04:00:00Z', ...overrides
});

test('whitespace variants of an official event identity cannot be counted twice', () => {
  const result = reconcileUberEarnings([fare(), fare({driverId:' driver-1 ',eventId:' fare-1 '})]);
  assert.equal(result.totalCents,1200);
  assert.equal(result.duplicates,1);
});

test('negative refund remains a distinct signed event, not another fare', () => {
  const result = reconcileUberEarnings([fare(),fare({eventId:'refund-1',eventType:'refund',amountCents:-350})]);
  assert.equal(result.totalCents,850);
  assert.equal(result.accepted.length,2);
  assert.ok(result.accepted.every(event=>event.status==='pending_review'));
});

test('a conflicting replay stays quarantined after a third identical replay', () => {
  const result = reconcileUberEarnings([fare(),fare({amountCents:1800}),fare()]);
  assert.equal(result.totalCents,0);
  assert.equal(result.accepted.length,0);
  assert.equal(result.conflicts.length,1);
});

test('an event from a different driver never collides with the same event ID', () => {
  const result = reconcileUberEarnings([fare(),fare({driverId:'driver-2'})]);
  assert.equal(result.totalCents,2400);
});
