import test from 'node:test';
import assert from 'node:assert/strict';
import {previewUberDays} from '../docs/uber/daily-preview.mjs';
const event=(eventId,occurredAt,amountCents,driverId='driver-1')=>({source:'uber-official',driverId,eventId,eventType:'trip',amountCents,currency:'EUR',occurredAt});
test('Brussels midnight and daylight saving are used, not UTC day',()=>{
 const p=previewUberDays([event('a','2026-10-24T22:30:00Z',100),event('b','2026-10-25T22:30:00Z',200)]);
 assert.deepEqual(p.days.map(x=>[x.day,x.totalCents]),[['2026-10-25',300]]); 
});

test('duplicate events do not inflate preview and drivers remain separate',()=>{
 const p=previewUberDays([event('a','2026-11-11T12:00:00Z',100),event('a','2026-11-11T12:00:00Z',100),event('b','2026-11-11T12:00:00Z',200,'driver-2')]);
 assert.equal(p.duplicates,1);
 assert.equal(p.days.length,2);
 assert.equal(p.days[0].status,'pending_review');
 assert.equal(p.status,'preview_only');
});
