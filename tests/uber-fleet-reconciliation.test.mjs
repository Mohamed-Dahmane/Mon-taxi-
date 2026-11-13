import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFleetEarning,deduplicateFleetEarnings} from '../lib/uber-fleet-reconciliation.mjs';
const payment={source:'uber_fleet',external_payment_id:'p-1',driver_external_id:'driver-1',currency:'EUR',gross_cents:1000,fee_cents:150,net_cents:850,local_service_date:'2026-11-12'};
test('accepts exact driver and reconciled cents',()=>assert.equal(validateFleetEarning(payment,'driver-1').net_cents,850));
test('rejects another driver',()=>assert.throws(()=>validateFleetEarning(payment,'driver-2'),/Driver mismatch/));
test('rejects missing identity',()=>assert.throws(()=>validateFleetEarning(payment,''),/identity required/));
test('rejects inconsistent amounts',()=>assert.throws(()=>validateFleetEarning({...payment,net_cents:900},'driver-1'),/reconcile/));
test('rejects fractional cents',()=>assert.throws(()=>validateFleetEarning({...payment,fee_cents:1.5},'driver-1'),/integer cents/));
test('rejects unsupported source',()=>assert.throws(()=>validateFleetEarning({...payment,source:'scraped'},'driver-1'),/Unapproved source/));
test('collapses identical duplicate',()=>assert.equal(deduplicateFleetEarnings([payment,payment],'driver-1').length,1));
test('rejects conflicting duplicate',()=>assert.throws(()=>deduplicateFleetEarnings([payment,{...payment,net_cents:800,gross_cents:950}],'driver-1'),/Conflicting duplicate/));
test('rejects impossible calendar date',()=>assert.throws(()=>validateFleetEarning({...payment,local_service_date:'2026-02-30'},'driver-1'),/Invalid service date/));
test('accepts leap-day calendar date',()=>assert.equal(validateFleetEarning({...payment,local_service_date:'2028-02-29'},'driver-1').local_service_date,'2028-02-29'));
test('rejects whitespace-altered payment ID',()=>assert.throws(()=>validateFleetEarning({...payment,external_payment_id:' p-1 '},'driver-1'),/Payment ID required/));

test('rejects invalid month and day',()=>{ for (const date of ['2026-13-01','2026-04-31','2026-02-29','0000-01-01']) assert.throws(()=>validateFleetEarning({...payment,local_service_date:date},'driver-1'),/Invalid service date/); });
test('rejects negative amounts',()=>assert.throws(()=>validateFleetEarning({...payment,gross_cents:-100,fee_cents:-150,net_cents:50},'driver-1'),/nonnegative/));
