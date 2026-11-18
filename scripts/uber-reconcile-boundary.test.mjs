// Regression tests for offline Uber earnings staging; no network or database writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectEvents } from './uber-reconcile-dryrun.mjs';

const base = {source:'uber_fleet',fleetId:'fleet-1',driverId:'driver-1',eventId:'trip-1',eventType:'trip',currency:'EUR',amountMinor:1234};

test('same event from two fleets is not silently deduplicated', () => {
  const r = inspectEvents([base, {...base,fleetId:'fleet-2'}]);
  assert.equal(r.accepted.length, 2);
  assert.equal(r.duplicates.length, 0);
  assert.equal(r.writesPerformed, 0);
});

test('same identifier in different event categories is preserved', () => {
  const r = inspectEvents([base, {...base,eventType:'tip',amountMinor:200}]);
  assert.equal(r.accepted.length, 2);
  assert.equal(r.quarantined.length, 0);
});

test('unknown event type cannot become income', () => {
  const r = inspectEvents([{...base,eventType:'transfer'}]);
  assert.equal(r.accepted.length, 0);
  assert.equal(r.quarantined[0].reason, 'unknown_event_type');
});

test('missing driver identity and malformed currency are quarantined', () => {
  const r = inspectEvents([{...base,driverId:''},{...base,currency:'eur'}]);
  assert.equal(r.accepted.length, 0);
  assert.equal(r.quarantined.length, 2);
});

test('input must be an array and caller input is not mutated', () => {
  assert.throws(() => inspectEvents({events:[base]}), /Expected an array/);
  const input = [structuredClone(base)];
  inspectEvents(input);
  assert.deepEqual(input, [base]);
});
