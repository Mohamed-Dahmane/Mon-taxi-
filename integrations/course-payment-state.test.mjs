import test from 'node:test';
import assert from 'node:assert/strict';
import { registerPayment, completeCourseFromPlanning, planningCourses } from './course-payment-state.mjs';

test('cash payment does not complete course', () => {
  const c = registerPayment({id:'a',status:'scheduled'}, {method:'cash',amountCents:2500});
  assert.equal(c.payment.status,'paid');
  assert.equal(c.status,'scheduled');
});
test('course can be completed with pending payment', () => {
  const c = completeCourseFromPlanning({id:'a',status:'scheduled'});
  assert.equal(c.status,'completed');
  assert.equal(c.payment,undefined);
  assert.equal(planningCourses([c]).length,0);
});
test('SumUp needs real confirmation', () => {
  assert.throws(()=>registerPayment({id:'a'}, {method:'sumup',amountCents:1000}), /sumup_confirmation_required/);
});
test('duplicate cash payment cannot be counted twice', () => {
  const c = registerPayment({id:'a'}, {method:'cash',amountCents:1000});
  assert.throws(()=>registerPayment(c,{method:'cash',amountCents:1000}), /already_paid/);
});
test('same confirmed SumUp reference is idempotent', () => {
  const p={method:'sumup',amountCents:1000,confirmed:true,reference:'tx1'};
  const c=registerPayment({id:'a'},p);
  assert.equal(registerPayment(c,p),c);
});

test('SumUp pending is not paid and does not complete course', async () => {
  const { markPaymentPending } = await import('./course-payment-state.mjs');
  const c = markPaymentPending({id:'a',status:'scheduled'});
  assert.equal(c.payment.status,'pending');
  assert.equal(c.status,'scheduled');
  assert.equal(markPaymentPending(c),c);
});
test('SumUp failure leaves course in Planning', async () => {
  const { markPaymentPending, markPaymentFailed } = await import('./course-payment-state.mjs');
  const c = markPaymentFailed(markPaymentPending({id:'a',status:'scheduled'}));
  assert.equal(c.payment.status,'failed');
  assert.equal(planningCourses([c]).length,1);
});

test('confirmed SumUp payment after pending keeps course scheduled', async () => {
  const { markPaymentPending } = await import('./course-payment-state.mjs');
  const pending = markPaymentPending({ id: 'ride-1', status: 'scheduled' });
  const paid = registerPayment(pending, {
    method: 'sumup', amountCents: 2400, confirmed: true, reference: 'sumup-tx-1'
  });
  assert.equal(paid.payment.status, 'paid');
  assert.equal(paid.status, 'scheduled');
  assert.equal(planningCourses([paid]).length, 1);
});
test('failed SumUp payment can be retried without completing the ride', async () => {
  const { markPaymentPending, markPaymentFailed } = await import('./course-payment-state.mjs');
  const failed = markPaymentFailed(markPaymentPending({ id: 'ride-2', status: 'scheduled' }));
  const retry = markPaymentPending(failed);
  assert.equal(retry.payment.status, 'pending');
  assert.equal(retry.status, 'scheduled');
});
test('cannot replace a paid SumUp transaction with a second reference', () => {
  const paid = registerPayment({ id: 'ride-3', status: 'scheduled' }, {
    method: 'sumup', amountCents: 1000, confirmed: true, reference: 'tx-a'
  });
  assert.throws(() => registerPayment(paid, {
    method: 'sumup', amountCents: 1000, confirmed: true, reference: 'tx-b'
  }), /already_paid/);
});

test('completed or cancelled courses cannot accept a new payment', () => {
 for (const status of ['completed','cancelled']) {
  assert.throws(
   () => registerPayment({id:'archived-1',status},{method:'cash',amountCents:2500}),
   /course_not_in_planning/
  );
 }
});

test('same SumUp reference with different amount is rejected', () => {
 const paid=registerPayment({id:'ride-amount'},{
  method:'sumup',amountCents:2500,reference:'tx-amount',confirmed:true
 });
 assert.throws(()=>registerPayment(paid,{
  method:'sumup',amountCents:3500,reference:'tx-amount',confirmed:true
 }),/already_paid/);
});
test('SumUp reference cannot be replayed as cash or without confirmation', () => {
 const paid=registerPayment({id:'ride-replay'},{
  method:'sumup',amountCents:2500,reference:'tx-replay',confirmed:true
 });
 assert.throws(()=>registerPayment(paid,{
  method:'cash',amountCents:2500,reference:'tx-replay'
 }),/already_paid/);
 assert.throws(()=>registerPayment(paid,{
  method:'sumup',amountCents:2500,reference:'tx-replay',confirmed:false
 }),/already_paid/);
});

test('SumUp cannot start on completed or cancelled courses', async () => {
 const {markPaymentPending}=await import('./course-payment-state.mjs');
 for(const status of ['completed','cancelled']) {
  assert.throws(()=>markPaymentPending({id:'ride-closed',status}),/course_not_in_planning/);
 }
});

test('payments accept exact centimes, including 0.75 EUR and 12.35 EUR',()=>{
 const small=registerPayment({id:'cents-1',status:'scheduled'},{method:'cash',amountCents:75});
 const larger=registerPayment({id:'cents-2',status:'scheduled'},{method:'cash',amountCents:1235});
 assert.equal(small.payment.amountCents,75);
 assert.equal(larger.payment.amountCents,1235);
 assert.equal(small.status,'scheduled');
});
test('fractional cent amount is rejected by the state module',()=>{
 assert.throws(()=>registerPayment({id:'fraction',status:'scheduled'},{method:'cash',amountCents:1234.5}),/invalid_amount/);
});

test('pending SumUp rejects cash but accepts verified matching SumUp settlement',()=>{
 const pending={id:'ride-pending',status:'scheduled',payment:{status:'pending',method:'sumup'}};
 assert.throws(()=>registerPayment(pending,{method:'cash',amountCents:1235}),/payment_pending_verification/);
 assert.throws(()=>registerPayment(pending,{method:'sumup',amountCents:1235,reference:'tx-unverified'}),/payment_pending_verification/);
 const settled=registerPayment(pending,{method:'sumup',amountCents:1235,reference:'tx-verified',confirmed:true});
 assert.equal(settled.payment.status,'paid');
 assert.equal(settled.status,'scheduled');
});

test('pending SumUp must be reconciled before course completion',()=>{
 const pending={id:'pending-completion',status:'scheduled',payment:{status:'pending',method:'sumup'}};
 assert.throws(()=>completeCourseFromPlanning(pending),/payment_pending_verification/);
 assert.equal(pending.status,'scheduled');
 const confirmed=registerPayment(pending,{method:'sumup',amountCents:1250,reference:'verified-tx',confirmed:true});
 assert.equal(completeCourseFromPlanning(confirmed).status,'completed');
});
