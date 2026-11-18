import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUberEarning,reconcileUberEarnings} from '../docs/uber/earnings-reconciliation.mjs';

const event={source:'uber-official',driverId:'driver-1',eventId:'event-1',tripId:'trip-1',eventType:'earning',amountCents:1500,currency:'EUR',occurredAt:'2026-11-11T10:00:00+01:00'};

test('input rows are not mutated by reconciliation',()=>{
 const input=Object.freeze({...event});
 const rows=Object.freeze([input]);
 const result=reconcileUberEarnings(rows);
 assert.equal(result.accepted.length,1);
 assert.equal(result.accepted[0].status,'pending_review');
 assert.deepEqual(input,event);
});
test('no monetary float, currency mismatch, or untrusted source accepted',()=>{
 for(const patch of [{amountCents:12.5},{amountCents:NaN},{amountCents:Number.MAX_SAFE_INTEGER+1},{currency:'USD'},{source:'spreadsheet'},{eventId:'  '}])
   assert.throws(()=>normalizeUberEarning({...event,...patch}));
});
test('identical event identifiers across drivers are separate',()=>{
 const result=reconcileUberEarnings([event,{...event,driverId:'driver-2'}]);
 assert.equal(result.accepted.length,2);
 assert.equal(result.totalCents,3000);
});
test('duplicate event with conflicting payload is excluded even when followed by repeats',()=>{
 const result=reconcileUberEarnings([event,{...event,amountCents:9999},event]);
 assert.equal(result.accepted.length,0);
 assert.equal(result.totalCents,0);
 assert.equal(result.conflicts.length,1);
});
test('sum overflow fails closed',()=>{
 assert.throws(()=>reconcileUberEarnings([event,{...event,eventId:'event-2',amountCents:Number.MAX_SAFE_INTEGER}]),/overflow/);
});
