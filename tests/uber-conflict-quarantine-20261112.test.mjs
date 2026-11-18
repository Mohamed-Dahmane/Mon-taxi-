import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileUberEarnings } from '../docs/uber/earnings-reconciliation.mjs';

const base = {source:'uber-official', driverId:'driver-A', eventId:'fare-1', tripId:'trip-1', eventType:'fare', amountCents:1000, currency:'EUR', occurredAt:'2026-11-12T01:00:00Z'};

test('conflicting replay quarantines entire fare while preserving independent tip', () => {
  const tip = {...base, eventId:'tip-1', eventType:'tip', amountCents:200};
  const result = reconcileUberEarnings([base, tip, {...base, amountCents:1200}, base]);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.accepted[0].eventId, 'tip-1');
  assert.equal(result.totalCents, 200);
});

test('same event identifier from another driver remains separate', () => {
  const result = reconcileUberEarnings([base, {...base, driverId:'driver-B', amountCents:300}]);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.accepted.length, 2);
  assert.equal(result.totalCents, 1300);
});

test('replayed stored event key cannot add a second fare', () => {
  const key = JSON.stringify([base.source, base.driverId, base.eventId]);
  const result = reconcileUberEarnings([base], [key]);
  assert.equal(result.accepted.length, 0);
  assert.equal(result.duplicates, 1);
  assert.equal(result.totalCents, 0);
});
