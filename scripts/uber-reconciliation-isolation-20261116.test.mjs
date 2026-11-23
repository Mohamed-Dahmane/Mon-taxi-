import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSourceMixing } from './uber-source-mixing-gate.mjs';

const trip = (patch = {}) => ({
  source: 'fleet', fleetId: 'fleet-A', driverId: 'driver-A',
  eventId: 'trip-1', eventType: 'trip', currency: 'EUR',
  amountMinor: 1000, ...patch
});

test('payout cannot enter earnings candidates', () => {
  const report = auditSourceMixing([trip({eventType:'payout',eventId:'payout-1'})]);
  assert.deepEqual(report.acceptedForReview, []);
  assert.equal(report.writesPerformed, 0);
});

test('cross-source uncertainty holds only the affected fleet and driver', () => {
  const report = auditSourceMixing([
    trip(), trip({source:'statement',eventId:'statement-9'}),
    trip({fleetId:'fleet-B',driverId:'driver-A',eventId:'trip-2'})
  ]);
  assert.deepEqual(report.acceptedForReview.map(x=>x.index), [2]);
  assert.ok(report.mixedDrivers.some(x=>x.indices.includes(0) && x.indices.includes(1)));
  assert.equal(report.writesPerformed, 0);
});

test('same event ID for distinct drivers is not a duplicate', () => {
  const report = auditSourceMixing([trip(),trip({driverId:'driver-B'})]);
  assert.deepEqual(report.acceptedForReview.map(x=>x.index), [0,1]);
  assert.equal(report.writesPerformed, 0);
});
