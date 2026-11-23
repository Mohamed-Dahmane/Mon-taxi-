import test from 'node:test';
import assert from 'node:assert/strict';
import {previewUberDays} from '../docs/uber/daily-preview.mjs';

const event=(eventId,eventType,amountCents,occurredAt='2026-11-11T12:00:00Z',driverId='driver-1')=>({
 source:'uber-official',driverId,eventId,tripId:'trip-123',eventType,amountCents,currency:'EUR',occurredAt
});

test('one trip can have a fare, tip, and negative adjustment without losing events',()=>{
 const p=previewUberDays([event('fare','trip',1200),event('tip','tip',300),event('refund','refund',-200)]);
 assert.equal(p.days.length,1);
 assert.equal(p.days[0].totalCents,1300);
 assert.equal(p.days[0].eventCount,3);
 assert.equal(p.status,'preview_only');
});

test('conflicting event payloads are quarantined and excluded from daily totals',()=>{
 const p=previewUberDays([event('same','trip',1200),event('same','trip',1400),event('valid','tip',100)]);
 assert.equal(p.conflicts.length,1);
 assert.equal(p.days[0].totalCents,100);
 assert.equal(p.days[0].eventCount,1);
});

test('previously imported idempotency keys do not inflate daily totals',()=>{
 const key=JSON.stringify(['uber-official','driver-1','fare']);
 const p=previewUberDays([event('fare','trip',1200),event('tip','tip',300)],[key]);
 assert.equal(p.duplicates,1);
 assert.equal(p.days[0].totalCents,300);
});

test('unauthorized or timezone-free input fails closed',()=>{
 assert.throws(()=>previewUberDays([{...event('x','trip',100),source:'manual'}]),/Unverified source/);
 assert.throws(()=>previewUberDays([{...event('x','trip',100),occurredAt:'2026-11-11T12:00:00'}]),/timezone/);
});
