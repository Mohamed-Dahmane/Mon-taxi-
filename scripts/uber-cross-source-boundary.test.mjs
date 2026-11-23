import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCrossSource } from './uber-cross-source-audit.mjs';

const base = {source:'uber_fleet',fleetId:'fleet-A',driverId:'driver-A',eventId:'trip-1',eventType:'trip',currency:'EUR',amountMinor:1200};

test('three independent source copies all require manual review',()=>{
 const input=[base,{...base,source:'uber_statement'},{...base,source:'other_official_statement'}];
 const r=auditCrossSource(input);
 assert.equal(r.acceptedForReview.length,0);
 assert.equal(r.crossSourceQuarantine.length,1);
 assert.equal(r.crossSourceQuarantine[0].items.length,3);
 assert.equal(r.writesPerformed,0);
});

test('same external event id in different fleets is not merged',()=>{
 const r=auditCrossSource([base,{...base,source:'uber_statement',fleetId:'fleet-B'}]);
 assert.equal(r.crossSourceQuarantine.length,0);
 assert.equal(r.acceptedForReview.length,2);
});

test('trip and tip with same id are distinct accounting events',()=>{
 const r=auditCrossSource([base,{...base,source:'uber_statement',eventType:'tip'}]);
 assert.equal(r.crossSourceQuarantine.length,0);
 assert.equal(r.acceptedForReview.length,2);
});

test('payout never enters cross-source revenue candidates',()=>{
 const r=auditCrossSource([{...base,eventType:'payout'},{...base,source:'uber_statement',eventType:'payout'}]);
 assert.equal(r.acceptedForReview.length,0);
 assert.equal(r.crossSourceQuarantine.length,0);
 assert.equal(r.excluded.length,2);
 assert.equal(r.writesPerformed,0);
});
