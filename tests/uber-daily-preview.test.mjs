import test from 'node:test';
import assert from 'node:assert/strict';
import {previewUberDays} from '../docs/uber/daily-preview.mjs';
const event=(eventId,occurredAt,amountCents,driverId='driver-1')=>({source:'uber-official',driverId,eventId,eventType:'trip',amountCents,currency:'EUR',occurredAt});
test('Brussels midnight and daylight saving are used, not UTC day',()=>{
 const p=previewUberDays([event('a','2026-10-24T22:30:00Z',100),event('b','2026-10-25T22:30:00Z',200)]);
 assert.deepEqual(p.days.map(x=>[x.day,x.totalCents]),[['2026-10-25',100],['2026-10-25',200]]); 
});
