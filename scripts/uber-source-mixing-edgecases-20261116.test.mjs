import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSourceMixing } from './uber-source-mixing-gate.mjs';

const trip = (patch = {}) => ({
  source: 'fleet', fleetId: 'fleet-A', driverId: 'driver-A',
  eventId: 'trip-1', eventType: 'trip', currency: 'EUR',
  amountMinor: 1000, ...patch
});

test('payout from another source does not quarantine a valid trip', () => {
  const report = auditSourceMixing([
    trip(),
    trip({source:'statement',eventType:'payout',eventId:'payout-1'})
  ]);
  assert.deepEqual(report.acceptedForReview.map(x => x.index), [0]);
  assert.equal(report.mixedDrivers.length, 0);
  assert.equal(report.writesPerformed, 0);
});

test('cross-source tip and trip for same driver are held for review', () => {
  const report = auditSourceMixing([
    trip(),
    trip({source:'statement',eventType:'tip',eventId:'tip-1',amountMinor:200})
  ]);
  assert.deepEqual(report.acceptedForReview, []);
  assert.equal(report.mixedDrivers.length, 1);
  assert.equal(report.writesPerformed, 0);
});

test('cross-source conflict does not quarantine another driver', () => {
  const report = auditSourceMixing([
    trip(), trip({source:'statement',eventId:'statement-1'}),
    trip({driverId:'driver-B',eventId:'trip-2'})
  ]);
  assert.deepEqual(report.acceptedForReview.map(x => x.index), [2]);
  assert.equal(report.writesPerformed, 0);
});
