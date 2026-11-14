import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileUberEarnings} from '../docs/uber/earnings-reconciliation.mjs';

const base = Object.freeze({source:'uber-official',driverId:'driver-A',eventId:'fare-17',tripId:'trip-17',eventType:'fare',amountCents:1200,currency:'EUR',occurredAt:'2026-11-12T09:00:00Z'});

test('conflicting replay quarantines the event regardless of arrival order', () => {
  for (const rows of [[base,{...base,amountCents:1500}],[{...base,amountCents:1500},base]]) {
    const result = reconcileUberEarnings(rows);
    assert.equal(result.totalCents,0);
    assert.equal(result.accepted.length,0);
    assert.equal(result.conflicts.length,1);
  }
});

test('a later identical replay cannot resurrect a quarantined event', () => {
  const result = reconcileUberEarnings([base,{...base,amountCents:1500},base]);
  assert.equal(result.totalCents,0);
  assert.equal(result.accepted.length,0);
  assert.equal(result.conflicts.length,1);
});

test('already known event never contributes to pending totals', () => {
  const key = JSON.stringify([base.source,base.driverId,base.eventId]);
  const result = reconcileUberEarnings([base],[key]);
  assert.equal(result.totalCents,0);
  assert.equal(result.accepted.length,0);
});

test('offline reconciliation does not mutate source rows', () => {
  const frozen = Object.freeze({...base});
  reconcileUberEarnings([frozen]);
  assert.equal(frozen.amountCents,1200);
});
