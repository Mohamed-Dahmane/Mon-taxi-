import test from 'node:test';
import assert from 'node:assert/strict';
import {previewUberDays} from '../docs/uber/daily-preview.mjs';
import {reconcileUberEarnings} from '../docs/uber/earnings-reconciliation.mjs';

const base={source:'uber-official',driverId:'driver-a',eventId:'e1',tripId:'trip-a',eventType:'earning',amountCents:1000,currency:'EUR',occurredAt:'2026-11-11T23:30:00Z'};

test('UTC midnight is grouped by Brussels local service day, not UTC day',()=>{
 const result=previewUberDays([base]);
 assert.equal(result.days[0].day,'2026-11-12');
 assert.equal(result.days[0].totalCents,1000);
 assert.equal(result.status,'preview_only');
 assert.equal(result.days[0].status,'pending_review');
});

test('same trip may have a separate negative adjustment on the next local day',()=>{
 const adjustment={...base,eventId:'e2',eventType:'adjustment',amountCents:-300,occurredAt:'2026-11-12T23:30:00Z'};
 const result=previewUberDays([base,adjustment]);
 assert.deepEqual(result.days.map(d=>[d.day,d.totalCents]),[['2026-11-12',1000],['2026-11-13',-300]]);
});

test('conflicting event is quarantined even when repeated after conflict',()=>{
 const conflicting={...base,amountCents:2000};
 const result=reconcileUberEarnings([base,conflicting,base]);
 assert.equal(result.accepted.length,0);
 assert.equal(result.totalCents,0);
 assert.equal(result.conflicts.length,1);
});

test('replayed events cannot reappear in daily preview',()=>{
 const key=JSON.stringify([base.source,base.driverId,base.eventId]);
 const result=previewUberDays([base],[key]);
 assert.equal(result.days.length,0);
 assert.equal(result.duplicates,1);
});
