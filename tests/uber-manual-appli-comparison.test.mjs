import test from 'node:test';
import assert from 'node:assert/strict';
import {compareUberWithManual} from '../docs/uber/manual-appli-comparison.mjs';
const earning=(id,amountCents,driverId='a')=>({source:'uber-official',driverId,eventId:id,
 eventType:'earning',amountCents,currency:'EUR',occurredAt:'2026-11-11T12:00:00Z'});
test('manual Appli is compared, never added or overwritten',()=>{
 const manual=[{driverId:'a',day:'2026-11-11',amountCents:1500}];
 const result=compareUberWithManual([earning('fare',1000),earning('tip',200),earning('fare',1000)],manual);
 assert.equal(result.status,'preview_only');
 assert.equal(result.duplicates,1);
 assert.equal(result.comparisons[0].totalCents,1200);
 assert.equal(result.comparisons[0].manualCents,1500);
 assert.equal(result.comparisons[0].differenceCents,-300);
 assert.equal(manual[0].amountCents,1500);
});
test('different driver never inherits manual earnings',()=>{
 const result=compareUberWithManual([earning('fare',500,'b')],[{driverId:'a',day:'2026-11-11',amountCents:500}]);
 assert.equal(result.comparisons[0].manualCents,null);
 assert.equal(result.comparisons[0].differenceCents,null);
});
test('duplicate manual day is rejected rather than guessed',()=>{
 assert.throws(()=>compareUberWithManual([],[
 {driverId:'a',day:'2026-11-11',amountCents:100},
 {driverId:'a',day:'2026-11-11',amountCents:200}
 ]),/Duplicate manual day/);
});

test('unsafe difference between Uber and manual Appli is rejected',()=>{
 assert.throws(()=>compareUberWithManual([earning('fare',2)],
  [{driverId:'a',day:'2026-11-11',amountCents:-Number.MAX_SAFE_INTEGER}]),
  /Manual comparison cents overflow/);
});
