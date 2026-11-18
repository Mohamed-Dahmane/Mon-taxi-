import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileUberEarnings} from '../docs/uber/earnings-reconciliation.mjs';
import {compareUberWithManual} from '../docs/uber/manual-appli-comparison.mjs';
const row=(x={})=>({source:'uber-official',driverId:'A',eventId:'fare-1',tripId:'trip-1',eventType:'fare',amountCents:1200,currency:'EUR',occurredAt:'2026-11-12T04:00:00Z',...x});
test('previously imported event cannot be counted twice',()=>{const r=row();const k=JSON.stringify([r.source,r.driverId,r.eventId]);const v=reconcileUberEarnings([r],[k]);assert.equal(v.totalCents,0);assert.equal(v.duplicates,1)});
test('driver identities isolate event IDs',()=>{const v=reconcileUberEarnings([row(),row({driverId:'B'})]);assert.equal(v.totalCents,2400);assert.equal(v.accepted.length,2)});
test('conflicting replay quarantined without editing manual Appli',()=>{const manual=Object.freeze({driverId:'A',day:'2026-11-12',amountCents:500});const v=compareUberWithManual([row(),row({amountCents:900})],[manual]);assert.equal(v.conflicts.length,1);assert.equal(v.comparisons.length,0);assert.equal(manual.amountCents,500)});
test('distinct tip remains separate',()=>{const v=reconcileUberEarnings([row(),row({eventId:'tip-1',eventType:'tip',amountCents:250})]);assert.equal(v.totalCents,1450)});
