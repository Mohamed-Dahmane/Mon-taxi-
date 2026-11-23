import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileUberEarnings} from '../docs/uber/earnings-reconciliation.mjs';

const base = {source:'uber-official',driverId:'driver-1',eventId:'earning-1',tripId:'trip-1',eventType:'earning',amountCents:1200,currency:'EUR',occurredAt:'2026-11-11T15:00:00+01:00'};
const key = row => JSON.stringify([row.source,row.driverId,row.eventId]);

test('replaying previously recorded events does not count them twice',()=>{
 const first=reconcileUberEarnings([base]);
 const replay=reconcileUberEarnings([base],first.accepted.map(x=>x.idempotencyKey));
 assert.equal(first.totalCents,1200);
 assert.equal(replay.totalCents,0);
 assert.equal(replay.accepted.length,0);
 assert.equal(replay.duplicates,1);
});
test('distinct adjustment for same trip remains eligible',()=>{
 const adjustment={...base,eventId:'adjustment-1',eventType:'adjustment',amountCents:-200};
 const result=reconcileUberEarnings([base,adjustment],[key(base)]);
 assert.equal(result.accepted.length,1);
 assert.equal(result.accepted[0].eventId,'adjustment-1');
 assert.equal(result.totalCents,-200);
});
test('same event id for a different driver is not a duplicate',()=>{
 const second={...base,driverId:'driver-2'};
 const result=reconcileUberEarnings([second],[key(base)]);
 assert.equal(result.accepted.length,1);
 assert.equal(result.totalCents,1200);
});
