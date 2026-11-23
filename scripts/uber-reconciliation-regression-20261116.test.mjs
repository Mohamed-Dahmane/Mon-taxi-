import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSourceMixing } from './uber-source-mixing-gate.mjs';

const trip = (patch = {}) => ({
  source: 'fleet', fleetId: 'fleet-1', driverId: 'driver-1',
  eventId: 'trip-1', eventType: 'trip', currency: 'EUR',
  amountMinor: 1200, ...patch
});

test('replayed identical trip is not counted twice', () => {
  const report = auditSourceMixing([trip(), trip()]);
  assert.deepEqual(report.accepted.map(x => x.index), [0]);
  assert.deepEqual(report.acceptedForReview.map(x => x.index), [0]);
  assert.deepEqual(report.duplicates.map(x => x.index), [1]);
  assert.equal(report.writesPerformed, 0);
});

test('conflicting same-source revision quarantines both original and revision', () => {
  const report = auditSourceMixing([trip(), trip({ amountMinor: 1500 })]);
  assert.deepEqual(report.accepted, []);
  assert.deepEqual(report.acceptedForReview, []);
  assert.ok(report.holds.some(x => x.reason === 'conflicting_amounts'));
  assert.equal(report.writesPerformed, 0);
});

test('invalid amount is quarantined, not accepted for import review', () => {
  const report = auditSourceMixing([trip({ amountMinor: 12.5 })]);
  assert.deepEqual(report.accepted, []);
  assert.deepEqual(report.acceptedForReview, []);
  assert.deepEqual(report.quarantined.map(x => x.index), [0]);
  assert.equal(report.writesPerformed, 0);
});
