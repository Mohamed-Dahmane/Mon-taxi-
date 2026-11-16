import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSourceMixing } from './uber-source-mixing-gate.mjs';

const event = (changes = {}) => ({
  source: 'fleet', fleetId: 'fleet-1', driverId: 'driver-1',
  eventId: 'trip-1', eventType: 'trip', currency: 'EUR',
  amountMinor: 1200, ...changes
});

test('payout is excluded from income and cannot create a cross-source hold', () => {
  const report = auditSourceMixing([
    event(),
    event({ source: 'statement', eventId: 'transfer-1', eventType: 'payout', amountMinor: 1200 })
  ]);
  assert.deepEqual(report.accepted.map(x => x.index), [0]);
  assert.deepEqual(report.acceptedForReview.map(x => x.index), [0]);
  assert.deepEqual(report.excluded.map(x => x.index), [1]);
  assert.equal(report.mixedDrivers.length, 0);
  assert.equal(report.writesPerformed, 0);
});

test('invalid event source is quarantined rather than treated as a second source', () => {
  const report = auditSourceMixing([event(), event({ source: '', eventId: 'trip-2' })]);
  assert.deepEqual(report.accepted.map(x => x.index), [0]);
  assert.deepEqual(report.acceptedForReview.map(x => x.index), [0]);
  assert.deepEqual(report.quarantined.map(x => x.index), [1]);
  assert.equal(report.mixedDrivers.length, 0);
  assert.equal(report.writesPerformed, 0);
});

test('a different event category across two sources is conservatively held', () => {
  const report = auditSourceMixing([
    event(),
    event({ source: 'statement', eventId: 'tip-1', eventType: 'tip', amountMinor: 200 })
  ]);
  assert.deepEqual(report.accepted, []);
  assert.deepEqual(report.acceptedForReview, []);
  assert.equal(report.mixedDrivers.length, 1);
  assert.equal(report.writesPerformed, 0);
});
