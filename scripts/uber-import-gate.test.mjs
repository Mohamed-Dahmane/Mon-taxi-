import test from 'node:test';
import assert from 'node:assert/strict';
import { auditImportCandidates } from './uber-import-gate.mjs';
const base={source:'uber_fleet',fleetId:'f1',driverId:'d1',eventId:'t1',eventType:'trip',currency:'EUR',amountMinor:1000};
test('conflicting revision blocks original too',()=>{const r=auditImportCandidates([base,{...base,amountMinor:1100}]);assert.equal(r.acceptedForReview.length,0);assert.equal(r.holds[0].reason,'conflicting_amounts');assert.equal(r.writesPerformed,0);});
test('two sources block even if amounts match',()=>{const r=auditImportCandidates([base,{...base,source:'uber_statement'}]);assert.equal(r.acceptedForReview.length,0);assert.equal(r.holds[0].reason,'multiple_sources');});
test('distinct drivers stay distinct',()=>{const r=auditImportCandidates([base,{...base,driverId:'d2',source:'uber_statement'}]);assert.equal(r.acceptedForReview.length,2);assert.equal(r.holds.length,0);});
test('payout excluded',()=>{const r=auditImportCandidates([{...base,eventType:'payout'}]);assert.equal(r.acceptedForReview.length,0);assert.equal(r.excluded.length,1);});
