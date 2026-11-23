import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSourceMixing } from './uber-source-mixing-gate.mjs';

const trip = (fleetId, source, eventId) => ({
  source, fleetId, driverId:'driver-shared', eventId,
  eventType:'trip', currency:'EUR', amountMinor:1200
});

test('same driver ID in distinct fleets must not trigger cross-fleet source mixing', () => {
  const result = auditSourceMixing([
    trip('fleet-a','fleet','a-1'),
    trip('fleet-b','statement','b-1')
  ]);
  assert.equal(result.mixedDrivers.length,0);
  assert.deepEqual(result.accepted.map(x=>x.index),[0,1]);
  assert.deepEqual(result.acceptedForReview.map(x=>x.index),[0,1]);
  assert.equal(result.writesPerformed,0);
});

test('mixing within one fleet holds only that fleet even with same driver ID elsewhere', () => {
  const result = auditSourceMixing([
    trip('fleet-a','fleet','a-1'),
    trip('fleet-a','statement','a-2'),
    trip('fleet-b','fleet','b-1')
  ]);
  assert.equal(result.mixedDrivers.length,1);
  assert.deepEqual(result.mixedDrivers[0].indices,[0,1]);
  assert.deepEqual(result.accepted.map(x=>x.index),[2]);
  assert.deepEqual(result.acceptedForReview.map(x=>x.index),[2]);
  assert.equal(result.writesPerformed,0);
});
