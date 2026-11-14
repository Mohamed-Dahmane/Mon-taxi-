import test from 'node:test';
import assert from 'node:assert/strict';
import {mapVerifiedFleetEarnings} from './verified-fleet-boundary.mjs';
import {reconcileUberEarnings} from './earnings-reconciliation.mjs';

const ctx={serverVerified:true,provider:'uber-fleet-supplier',authorizedDriverId:'driver-A',fleetId:'fleet-1'};
const event=(overrides={})=>({driverId:'driver-A',eventId:'payment-1',tripId:'trip-1',eventType:'fare',amountCents:1234,currency:'EUR',occurredAt:'2026-11-13T20:00:00Z',...overrides});
test('rejects missing or browser-supplied unverified fleet context',()=>{
  for(const context of [undefined,{}, {...ctx,serverVerified:false},{...ctx,provider:'manual'},{...ctx,authorizedDriverId:''},{...ctx,fleetId:''}])
    assert.throws(()=>mapVerifiedFleetEarnings([event()],context),/authorization required/);
});
test('rejects a different fleet driver without staging any rows',()=>{
  assert.throws(()=>mapVerifiedFleetEarnings([event(),event({driverId:'driver-B',eventId:'payment-2'})],ctx),/driver mismatch/);
});
test('rejects missing event identifiers, invalid precision and timezone',()=>{
  for(const changes of [{eventId:''},{amountCents:12.5},{currency:'USD'},{occurredAt:'2026-11-13T20:00:00'}])
    assert.throws(()=>mapVerifiedFleetEarnings([event(changes)],ctx));
});
test('repeated identical events stage once and do not alter manual Appli',()=>{
  const manualAppliCents=5500;
  const rows=mapVerifiedFleetEarnings([event(),event()],ctx);
  const result=reconcileUberEarnings(rows);
  assert.equal(result.accepted.length,1);
  assert.equal(result.duplicates,1);
  assert.equal(result.totalCents,1234);
  assert.equal(result.accepted[0].status,'pending_review');
  assert.equal(manualAppliCents,5500);
});
test('conflicting duplicate event is quarantined, not counted',()=>{
  const rows=mapVerifiedFleetEarnings([event(),event({amountCents:2000})],ctx);
  const result=reconcileUberEarnings(rows);
  assert.equal(result.accepted.length,0);
  assert.equal(result.conflicts.length,1);
  assert.equal(result.totalCents,0);
});
test('different earning events on one trip are not mistakenly collapsed',()=>{
  const rows=mapVerifiedFleetEarnings([event(),event({eventId:'tip-1',eventType:'tip',amountCents:200})],ctx);
  const result=reconcileUberEarnings(rows);
  assert.equal(result.accepted.length,2);
  assert.equal(result.totalCents,1434);
});
test('existing idempotency key prevents reimport',()=>{
  const rows=mapVerifiedFleetEarnings([event()],ctx);
  const key=JSON.stringify(['uber-official','driver-A','payment-1']);
  const result=reconcileUberEarnings(rows,[key]);
  assert.equal(result.accepted.length,0);
  assert.equal(result.duplicates,1);
});
