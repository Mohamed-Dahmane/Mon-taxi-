import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileUberEarnings} from '../docs/uber/earnings-reconciliation.mjs';

const base = {source:'uber-official',driverId:'driver-A',eventId:'fare-42',tripId:'trip-42',eventType:'fare',amountCents:2400,currency:'EUR',occurredAt:'2026-11-12T09:00:00Z'};

test('conflicting replay quarantines the event instead of selecting either amount', () => {
  const result = reconcileUberEarnings([base,{...base,amountCents:2500},base]);
  assert.equal(result.accepted.length,0);
  assert.equal(result.totalCents,0);
  assert.equal(result.conflicts.length,1);
});

test('distinct tip event on same trip is counted once, separate from fare', () => {
  const tip={...base,eventId:'tip-42',eventType:'tip',amountCents:300};
  const result=reconcileUberEarnings([base,tip,tip]);
  assert.equal(result.accepted.length,2);
  assert.equal(result.totalCents,2700);
  assert.equal(result.duplicates,1);
  assert.ok(result.accepted.every(x=>x.status==='pending_review'));
});

test('previously imported event is not counted again', () => {
  const first=reconcileUberEarnings([base]);
  const second=reconcileUberEarnings([base],first.accepted.map(x=>x.idempotencyKey));
  assert.equal(second.accepted.length,0);
  assert.equal(second.totalCents,0);
  assert.equal(second.duplicates,1);
});
