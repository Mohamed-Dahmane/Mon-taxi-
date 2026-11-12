import test from 'node:test';
import assert from 'node:assert/strict';
import {mapVerifiedFleetEarnings} from '../docs/uber/verified-fleet-boundary.mjs';
const ctx={serverVerified:true,provider:'uber-fleet-supplier',authorizedDriverId:'A',fleetId:'fleet-1'};
const event={driverId:'A',eventId:'e-1',tripId:'t-1',eventType:'fare',amountCents:1234,currency:'EUR',occurredAt:'2026-11-12T06:00:00Z'};
test('unverified or missing fleet authorization fails closed',()=>{
  assert.throws(()=>mapVerifiedFleetEarnings([event],{}));
  assert.throws(()=>mapVerifiedFleetEarnings([event],{...ctx,serverVerified:false}));
});
test('cross-driver earnings rejected as an entire batch',()=>{
  assert.throws(()=>mapVerifiedFleetEarnings([event,{...event,driverId:'B'}],ctx),/driver mismatch/);
});
test('verified normalized event remains pending for reconciliation',()=>{
  const rows=mapVerifiedFleetEarnings([event],ctx);
  assert.equal(rows[0].source,'uber-official');
  assert.equal(rows[0].amountCents,1234);
  assert.equal(rows[0].driverId,'A');
});
