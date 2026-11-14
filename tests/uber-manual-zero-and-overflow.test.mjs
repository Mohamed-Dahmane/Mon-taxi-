import test from 'node:test';
import assert from 'node:assert/strict';
import {compareUberWithManual} from '../docs/uber/manual-appli-comparison.mjs';

const event = (overrides = {}) => ({
  source:'uber-official', driverId:'driver-A', eventId:'event-1',
  tripId:'trip-1', eventType:'fare', amountCents:1250,
  currency:'EUR', occurredAt:'2026-11-11T12:00:00Z', ...overrides
});

test('manual zero is an explicit amount, not a missing day', () => {
  const result = compareUberWithManual([event()], [{driverId:'driver-A',day:'2026-11-11',amountCents:0}]);
  assert.equal(result.status, 'preview_only');
  assert.equal(result.comparisons[0].manualCents, 0);
  assert.equal(result.comparisons[0].differenceCents, 1250);
  assert.equal(result.comparisons[0].status, 'pending_review');
});

test('negative manual amount remains unchanged in preview', () => {
  const manual = [{driverId:'driver-A',day:'2026-11-11',amountCents:-250}];
  const result = compareUberWithManual([event()], manual);
  assert.equal(result.comparisons[0].differenceCents, 1500);
  assert.equal(manual[0].amountCents, -250);
});

test('manual days cannot silently overwrite each other', () => {
  const row = {driverId:'driver-A',day:'2026-11-11',amountCents:1250};
  assert.throws(() => compareUberWithManual([event()], [row,row]), /Duplicate manual day/);
});

test('manual comparison refuses unsafe integer arithmetic', () => {
  assert.throws(() => compareUberWithManual([event({amountCents:Number.MAX_SAFE_INTEGER})],
    [{driverId:'driver-A',day:'2026-11-11',amountCents:-1}]), /overflow/i);
});

test('unverified input never becomes an Appli comparison', () => {
  assert.throws(() => compareUberWithManual([event({source:'manual'})], []), /Unverified source/);
});
