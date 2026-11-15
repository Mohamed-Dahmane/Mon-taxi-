import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectEvents } from './uber-reconcile-dryrun.mjs';

const base = {source:'uber_fleet',fleetId:'fleet-1',driverId:'driver-1',eventId:'trip-1',eventType:'trip',currency:'EUR',amountMinor:1250};
test('first event is staged only; no writes', () => {
  const r=inspectEvents([base]);
  assert.equal(r.accepted.length,1); assert.equal(r.writesPerformed,0);
});
test('replay is not double counted', () => {
  const r=inspectEvents([base,{...base}]);
  assert.equal(r.accepted.length,1); assert.equal(r.duplicates.length,1);
});
test('conflicting revision is quarantined', () => {
  const r=inspectEvents([base,{...base,amountMinor:1300}]);
  assert.equal(r.accepted.length,1); assert.equal(r.quarantined[0].reason,'conflicting_revision_requires_review');
});
test('different driver or event type is not conflated', () => {
  const r=inspectEvents([base,{...base,driverId:'driver-2'},{...base,eventType:'tip'}]);
  assert.equal(r.accepted.length,3);
});
test('payout excluded, malformed and unknown events quarantined', () => {
  const r=inspectEvents([{...base,eventType:'payout'}, {...base,currency:'EU'}, {...base,eventType:'unknown'},null]);
  assert.equal(r.excluded.length,1); assert.equal(r.quarantined.length,3); assert.equal(r.writesPerformed,0);
});
test('invalid top-level payload rejected', () => assert.throws(()=>inspectEvents({}),/array/));
