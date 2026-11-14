import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileFleetPaymentPages } from './uber-fleet-pages-reconciliation.js';
const payment = (id, amount=10, driver='verified') => ({
  payment_id:id, event_time:1794000000, amount, currency_code:'EUR',
  cash_collected:0, category:'trip', trip_id:'trip-'+id, driver_id:driver
});
const opts={verifiedDriverId:'verified'};
test('stages two pages without committing to Appli',()=>{
 const result=reconcileFleetPaymentPages([[payment('a')],[payment('b')]],[],opts);
 assert.equal(result.inserted.length,2);
 assert.equal(result.writeToAppli,false);
 assert.equal(result.commitAllowed,false);
 assert.equal(result.processedPages,2);
});
test('repeated payment across pages is not counted twice',()=>{
 const result=reconcileFleetPaymentPages([[payment('a')],[payment('a')]],[],opts);
 assert.deepEqual(result.inserted.map(x=>x.externalId),['a']);
});
test('changed amount on later page fails entire batch',()=>{
 assert.throws(()=>reconcileFleetPaymentPages([[payment('a')],[payment('a',11)]],[],opts),/Conflicting/);
});
test('foreign driver on later page fails entire batch',()=>{
 assert.throws(()=>reconcileFleetPaymentPages([[payment('a')],[payment('b',10,'foreign')]],[],opts),/identity mismatch/);
});
test('existing staged record is not mutated',()=>{
 const old=reconcileFleetPaymentPages([[payment('a')]],[],opts).inserted;
 const snapshot=JSON.stringify(old);
 const result=reconcileFleetPaymentPages([[payment('a')],[payment('b')]],old,opts);
 assert.deepEqual(result.inserted.map(x=>x.externalId),['b']);
 assert.deepEqual(result.unchanged,['a']);
 assert.equal(JSON.stringify(old),snapshot);
});
test('missing verified driver is rejected',()=>{
 assert.throws(()=>reconcileFleetPaymentPages([[payment('a')]],[],{}),/Verified driver/);
});
