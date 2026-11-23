import test from 'node:test';
import assert from 'node:assert/strict';
import {previewUberDays} from '../docs/uber/daily-preview.mjs';

const event=(id,at,amountCents=100)=>({
 source:'uber-official',driverId:'driver-a',eventId:id,tripId:'same-trip',
 eventType:'earning',amountCents,currency:'EUR',occurredAt:at
});

test('spring DST change keeps both authorized events on the same Brussels day',()=>{
 const result=previewUberDays([
  event('before','2026-03-29T00:30:00Z'),
  event('after','2026-03-29T01:30:00Z')
 ]);
 assert.deepEqual(result.days.map(d=>[d.day,d.totalCents,d.eventCount]),[['2026-03-29',200,2]]);
 assert.equal(result.status,'preview_only');
});

test('autumn repeated local hour does not double count a replay',()=>{
 const first=event('one','2026-10-25T00:30:00Z');
 const second=event('two','2026-10-25T01:30:00Z');
 const result=previewUberDays([first,second,first]);
 assert.deepEqual(result.days.map(d=>[d.day,d.totalCents,d.eventCount]),[['2026-10-25',200,2]]);
 assert.equal(result.duplicates,1);
});

test('two distinct earning events on one trip remain separate',()=>{
 const result=previewUberDays([event('fare','2026-11-11T12:00:00Z',1200),
  {...event('tip','2026-11-11T12:02:00Z',250),eventType:'tip'}]);
 assert.equal(result.days[0].totalCents,1450);
 assert.equal(result.days[0].eventCount,2);
 assert.equal(result.days[0].status,'pending_review');
});
