import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectEvents } from './uber-reconcile-dryrun.mjs';

const base = {source:'uber_fleet',fleetId:'fleet-1',driverId:'driver-1',eventId:'event-1',eventType:'trip',currency:'EUR',amountMinor:1250};

test('same event ID from two source channels remains separate pending cross-source reconciliation', () => {
  const result = inspectEvents([base, {...base,source:'uber_statement'}]);
  assert.equal(result.accepted.length, 2);
  assert.equal(result.duplicates.length, 0);
  assert.equal(result.writesPerformed, 0);
});

test('replaying one event three times accepts only one', () => {
  const result = inspectEvents([base, {...base}, {...base}]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.duplicates.length, 2);
});

test('zero-value and negative adjustments are preserved for review without database writes', () => {
  const result = inspectEvents([{...base,amountMinor:0}, {...base,eventId:'event-2',eventType:'adjustment',amountMinor:-200}]);
  assert.deepEqual(result.accepted.map(x => x.amountMinor), [0,-200]);
  assert.equal(result.writesPerformed, 0);
});

test('conflicting event revisions do not silently replace accepted amount', () => {
  const result = inspectEvents([base,{...base,amountMinor:2500}]);
  assert.equal(result.accepted[0].amountMinor,1250);
  assert.equal(result.quarantined[0].reason,'conflicting_revision_requires_review');
});
