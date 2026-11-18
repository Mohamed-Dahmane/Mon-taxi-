import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCrossSource } from './uber-cross-source-audit.mjs';
const base={source:'uber_fleet',fleetId:'f',driverId:'d',eventId:'t',eventType:'trip',currency:'EUR',amountMinor:1000};
test('same trip across Fleet and statement is held for review',()=>{
 const r=auditCrossSource([base,{...base,source:'uber_statement'}]);
 assert.equal(r.acceptedForReview.length,0);
 assert.equal(r.crossSourceQuarantine[0].reason,'cross_source_possible_duplicate');
 assert.equal(r.writesPerformed,0);
});
test('conflicting cross-source amounts are quarantined',()=>{
 const r=auditCrossSource([base,{...base,source:'uber_statement',amountMinor:900}]);
 assert.equal(r.crossSourceQuarantine[0].reason,'cross_source_amount_conflict');
});
test('different drivers remain separate',()=>{
 const r=auditCrossSource([base,{...base,source:'uber_statement',driverId:'other'}]);
 assert.equal(r.acceptedForReview.length,2);
 assert.equal(r.crossSourceQuarantine.length,0);
});
test('same-source replay is handled by existing deduplication',()=>{
 const r=auditCrossSource([base,{...base}]);
 assert.equal(r.duplicates.length,1);
 assert.equal(r.crossSourceQuarantine.length,0);
});
