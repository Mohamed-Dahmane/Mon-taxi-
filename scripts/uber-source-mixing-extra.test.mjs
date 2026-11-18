import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSourceMixing } from './uber-source-mixing-gate.mjs';

const make = (changes={}) => ({
  source:'fleet', fleetId:'fleet-a', driverId:'driver-a',
  eventId:'trip-a', eventType:'trip', currency:'EUR', amountMinor:1250,
  ...changes
});

test('three source records for one driver are all held', () => {
  const result = auditSourceMixing([
    make(), make({source:'statement',eventId:'statement-a'}),
    make({source:'manual',eventId:'manual-a'})
  ]);
  assert.deepEqual(result.accepted, []);
  assert.deepEqual(result.acceptedForReview, []);
  assert.equal(result.mixedDrivers.length,1);
  assert.equal(result.mixedDrivers[0].indices.length,3);
  assert.equal(result.writesPerformed,0);
});

test('a mixed driver does not block another driver in the same fleet', () => {
  const result = auditSourceMixing([
    make(), make({source:'statement',eventId:'statement-a'}),
    make({driverId:'driver-b',eventId:'trip-b'})
  ]);
  assert.deepEqual(result.accepted.map(x=>x.index),[2]);
  assert.deepEqual(result.acceptedForReview.map(x=>x.index),[2]);
  assert.equal(result.writesPerformed,0);
});

test('an identical event repeated with conflicting amount is held', () => {
  const result = auditSourceMixing([make(),make({amountMinor:1500})]);
  assert.deepEqual(result.accepted,[]);
  assert.deepEqual(result.acceptedForReview,[]);
  assert.equal(result.writesPerformed,0);
});
