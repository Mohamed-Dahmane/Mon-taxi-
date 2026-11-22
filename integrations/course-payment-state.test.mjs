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
