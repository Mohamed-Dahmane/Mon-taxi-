import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUberEarning, reconcileUberEarnings} from '../docs/uber/earnings-reconciliation.mjs';
const base = {source:'uber-official',driverId:'driver-1',tripId:'trip-1',eventId:'earning-1',eventType:'earning',amountCents:2000,currency:'EUR',occurredAt:'2026-11-11T09:00:00Z'};
test('reimporting same event is idempotent', () => {
 const r=reconcileUberEarnings([base,base]); assert.equal(r.accepted.length,1); assert.equal(r.duplicates,1);
 assert.equal(reconcileUberEarnings([base], [r.accepted[0].idempotencyKey]).accepted.length,0);
});
test('distinct events of same trip survive, including negative refund', () => {
 const r=reconcileUberEarnings([base,{...base,eventId:'tip-1',eventType:'tip',amountCents:300},{...base,eventId:'refund-1',eventType:'refund',amountCents:-500}]);
 assert.equal(r.accepted.length,3); assert.equal(r.totalCents,1800);
 assert.ok(r.accepted.every(x=>x.status==='pending_review'));
});
test('same event ID from two drivers is not conflated', () => {
 assert.equal(reconcileUberEarnings([base,{...base,driverId:'driver-2'}]).accepted.length,2);
});
test('missing event ID and invalid timestamp are rejected', () => {
 assert.throws(()=>normalizeUberEarning({...base,eventId:''}));
 assert.throws(()=>normalizeUberEarning({...base,occurredAt:'2026-11-11T09:00:00'}));
});

test('conflicting payloads sharing event ID are quarantined, not silently deduplicated', () => {
 const changed={...base,amountCents:2500};
 const result=reconcileUberEarnings([base,changed,base]);
 assert.equal(result.accepted.length,0);
 assert.equal(result.totalCents,0);
 assert.equal(result.conflicts.length,1);
});
