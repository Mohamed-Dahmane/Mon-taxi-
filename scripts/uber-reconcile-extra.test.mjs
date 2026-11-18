import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectEvents } from './uber-reconcile-dryrun.mjs';
const base = {source:'uber_fleet',fleetId:'fleet-1',driverId:'driver-1',eventId:'event-1',eventType:'trip',currency:'EUR',amountMinor:1250};
test('negative adjustment is staged without altering existing earnings',()=>{const r=inspectEvents([base,{...base,eventId:'adj-1',eventType:'adjustment',amountMinor:-250}]);assert.equal(r.accepted.length,2);assert.equal(r.accepted[1].amountMinor,-250);assert.equal(r.writesPerformed,0)});
test('same event identifier with different currency is quarantined',()=>{const r=inspectEvents([base,{...base,currency:'USD'}]);assert.equal(r.accepted.length,1);assert.equal(r.quarantined[0].reason,'conflicting_revision_requires_review')});
test('unsafe numeric amounts cannot enter staging',()=>{const r=inspectEvents([{...base,amountMinor:Number.MAX_SAFE_INTEGER+1},{...base,amountMinor:NaN},{...base,amountMinor:1.5}]);assert.equal(r.accepted.length,0);assert.equal(r.quarantined.length,3)});
test('payouts are never treated as income, even if repeated',()=>{const r=inspectEvents([{...base,eventType:'payout'},{...base,eventType:'payout'}]);assert.equal(r.accepted.length,0);assert.equal(r.excluded.length,2);assert.equal(r.writesPerformed,0)});
