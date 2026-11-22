import test from 'node:test';
import assert from 'node:assert/strict';
import { createCourseActions } from './course-actions-adapter.mjs';

function setup(initial) {
  const courses = new Map([[initial.id, structuredClone(initial)]]);
  const receipts = new Set();
  const actions = createCourseActions({
    getCourse: async id => courses.get(id),
    saveCourse: async course => { courses.set(course.id, course); },
    recordCashReceipt: async ({courseId, course}) => {
      if (receipts.has(courseId)) return false;
      // Simulate the host's atomic cash receipt + course state commit.
      receipts.add(courseId);
      courses.set(courseId, course);
      return true;
    }
  });
  return { courses, receipts, actions };
}

test('cash payment remains in Planning until explicitly completed', async () => {
  const {courses, actions} = setup({id:'ride-1',status:'scheduled'});
  const result = await actions.recordFarePayment('ride-1','cash',1250);
  assert.equal(result.recorded,true);
  assert.equal(courses.get('ride-1').status,'scheduled');
  assert.equal(courses.get('ride-1').payment.status,'paid');
  await actions.completeFromPlanning('ride-1');
  assert.equal(courses.get('ride-1').status,'completed');
});

test('cash payment cannot be recorded twice', async () => {
  const {actions, receipts} = setup({id:'ride-2',status:'scheduled'});
  await actions.recordFarePayment('ride-2','cash',1250);
  await assert.rejects(actions.recordFarePayment('ride-2','cash',1250),/already_paid/);
  assert.equal(receipts.size,1);
});

test('unpaid course can still be completed from Planning', async () => {
  const {courses,actions} = setup({id:'ride-3',status:'scheduled'});
  await actions.completeFromPlanning('ride-3');
  assert.equal(courses.get('ride-3').status,'completed');
  assert.equal(courses.get('ride-3').payment,undefined);
});

test('unconfirmed SumUp payment cannot be recorded', async () => {
  const {courses,actions} = setup({id:'ride-4',status:'scheduled'});
  await assert.rejects(actions.recordFarePayment('ride-4','sumup',1250),/sumup_confirmation_required/);
  assert.equal(courses.get('ride-4').payment,undefined);
});

test('SumUp reference alone cannot prove payment', async () => {
  const {courses, actions} = setup({id:'ride-5',status:'scheduled'});
  await assert.rejects(actions.recordFarePayment('ride-5','sumup',1250,'tx-unverified'),/sumup_verifier_unavailable/);
  assert.equal(courses.get('ride-5').payment,undefined);
});
test('SumUp verifier rejection leaves payment unrecorded', async () => {
  const courses = new Map([['ride-6',{id:'ride-6',status:'scheduled'}]]);
  const actions = createCourseActions({
    getCourse: async id => courses.get(id),
    saveCourse: async course => courses.set(course.id,course),
    recordCashReceipt: async () => true,
    verifySumUpTransaction: async () => false
  });
  await assert.rejects(actions.recordFarePayment('ride-6','sumup',1250,'tx-declined'),/sumup_payment_not_verified/);
  assert.equal(courses.get('ride-6').payment,undefined);
});

test('Planning completion is idempotent and does not create a receipt', async () => {
  const courses = new Map([['ride-7',{id:'ride-7',status:'scheduled'}]]);
  let completions=0;
  const actions = createCourseActions({
    getCourse: async id => courses.get(id),
    saveCourse: async () => { throw new Error('should_not_use_non_atomic_save'); },
    recordCashReceipt: async () => { throw new Error('should_not_record_cash'); },
    completeCourseAtomically: async ({courseId,course}) => {
      completions++;
      courses.set(courseId,course);
      return true;
    }
  });
  await actions.completeFromPlanning('ride-7');
  await actions.completeFromPlanning('ride-7');
  assert.equal(completions,1);
  assert.equal(courses.get('ride-7').status,'completed');
});
test('failed atomic completion leaves course in Planning', async () => {
  const courses = new Map([['ride-8',{id:'ride-8',status:'scheduled'}]]);
  const actions = createCourseActions({
    getCourse: async id => courses.get(id),
    saveCourse: async () => {},
    recordCashReceipt: async () => true,
    completeCourseAtomically: async () => false
  });
  await assert.rejects(actions.completeFromPlanning('ride-8'),/course_completion_not_committed/);
  assert.equal(courses.get('ride-8').status,'scheduled');
});

test('closed rides cannot create a cash receipt or trigger SumUp verification',async()=>{
 for(const status of ['completed','cancelled']){
  let cashCalls=0,verifyCalls=0,saveCalls=0;
  const actions=createCourseActions({
   getCourse:async()=>({id:'closed-ride',status}),
   saveCourse:async()=>{saveCalls++;},
   recordCashReceipt:async()=>{cashCalls++;return true;},
   verifySumUpTransaction:async()=>{verifyCalls++;return true;}
  });
  await assert.rejects(actions.recordFarePayment('closed-ride','cash',1235),/course_not_in_planning/);
  await assert.rejects(actions.recordFarePayment('closed-ride','sumup',1235,'tx-closed'),/course_not_in_planning/);
  assert.equal(cashCalls,0);
  assert.equal(verifyCalls,0);
  assert.equal(saveCalls,0);
 }
});

test('pending SumUp blocks new cash or SumUp charge until reconciliation',async()=>{
 let cash=0,verification=0;
 const actions=createCourseActions({
  getCourse:async()=>({id:'pending-ride',status:'scheduled',payment:{status:'pending',method:'sumup'}}),
  saveCourse:async()=>{throw Error('unexpected_save');},
  recordCashReceipt:async()=>{cash++;return true;},
  verifySumUpTransaction:async()=>{verification++;return true;}
 });
 await assert.rejects(actions.recordFarePayment('pending-ride','cash',1235),/payment_pending_verification/);
 await assert.rejects(actions.recordFarePayment('pending-ride','sumup',1235),/payment_pending_verification/);
 assert.equal(cash,0);
 assert.equal(verification,0);
});

test('verified SumUp reconciliation settles pending payment without completing ride',async()=>{
 const courses=new Map([['pending-reconcile',{id:'pending-reconcile',status:'scheduled',payment:{status:'pending',method:'sumup'}}]]);
 let checks=0;
 const actions=createCourseActions({
  getCourse:async id=>courses.get(id),
  saveCourse:async course=>{courses.set(course.id,course);},
  recordCashReceipt:async()=>{throw Error('cash_not_expected');},
  verifySumUpTransaction:async({courseId,amountCents,reference})=>{
   checks++;
   return courseId==='pending-reconcile'&&amountCents===1235&&reference==='tx-confirmed';
  }
 });
 const result=await actions.recordFarePayment('pending-reconcile','sumup',1235,'tx-confirmed');
 assert.equal(result.recorded,true);
 assert.equal(courses.get('pending-reconcile').payment.status,'paid');
 assert.equal(courses.get('pending-reconcile').status,'scheduled');
 assert.equal(checks,1);
});

test('unverified SumUp reconciliation keeps pending ride and creates no cash receipt',async()=>{
 const course={id:'pending-unverified',status:'scheduled',payment:{status:'pending',method:'sumup'}};
 let saves=0,cash=0;
 const actions=createCourseActions({
  getCourse:async()=>course,
  saveCourse:async()=>{saves++;},
  recordCashReceipt:async()=>{cash++;return true;},
  verifySumUpTransaction:async()=>false
 });
 await assert.rejects(actions.recordFarePayment('pending-unverified','sumup',1235,'tx-unverified'),/sumup_payment_not_verified/);
 assert.equal(course.payment.status,'pending');
 assert.equal(saves,0);
 assert.equal(cash,0);
});

test('invalid cents or method cannot call payment side effects',async()=>{
 let cash=0,verify=0,saves=0;
 const actions=createCourseActions({
  getCourse:async()=>({id:'invalid',status:'scheduled'}),
  saveCourse:async()=>{saves++;},
  recordCashReceipt:async()=>{cash++;return true;},
  verifySumUpTransaction:async()=>{verify++;return true;}
 });
 for(const cents of [12.5,-1,NaN,Infinity]){
  await assert.rejects(actions.recordFarePayment('invalid','cash',cents),/invalid_amount/);
  await assert.rejects(actions.recordFarePayment('invalid','sumup',cents,'tx'),/invalid_amount/);
 }
 await assert.rejects(actions.recordFarePayment('invalid','other',1235),/unsupported_payment_method/);
 assert.deepEqual([cash,verify,saves],[0,0,0]);
});
test('SumUp verification without persisted payment never announces recorded',async()=>{
 const course={id:'unsaved',status:'scheduled'};
 const actions=createCourseActions({
  getCourse:async()=>course,
  saveCourse:async()=>true,
  recordCashReceipt:async()=>true,
  verifySumUpTransaction:async()=>true
 });
 await assert.rejects(actions.recordFarePayment('unsaved','sumup',1235,'tx-verified'),/sumup_payment_not_committed/);
 assert.equal(course.payment,undefined);
});

test('cash callback success without persisted receipt cannot announce payment',async()=>{
 const original={id:'cash-uncommitted',status:'scheduled'};
 let calls=0;
 const actions=createCourseActions({
  getCourse:async()=>original,
  saveCourse:async()=>{throw Error('unexpected_save');},
  recordCashReceipt:async()=>{calls++;return true;}
 });
 await assert.rejects(actions.recordFarePayment('cash-uncommitted','cash',1235),/cash_receipt_not_committed/);
 assert.equal(calls,1);
 assert.equal(original.payment,undefined);
});
test('completion callback success without persisted status cannot archive ride',async()=>{
 const original={id:'completion-uncommitted',status:'scheduled'};
 const actions=createCourseActions({
  getCourse:async()=>original,
  saveCourse:async()=>true,
  recordCashReceipt:async()=>true,
  completeCourseAtomically:async()=>true
 });
 await assert.rejects(actions.completeFromPlanning('completion-uncommitted'),/course_completion_not_committed/);
 assert.equal(original.status,'scheduled');
});

test('cash receipt must not silently complete the ride or return another course',async()=>{
 for(const mutated of [
  {id:'cash-preserve',status:'completed',payment:{status:'paid',method:'cash',amountCents:1250}},
  {id:'another-course',status:'scheduled',payment:{status:'paid',method:'cash',amountCents:1250}}
 ]){
  let stored={id:'cash-preserve',status:'scheduled'};
  const actions=createCourseActions({
   getCourse:async()=>stored,
   saveCourse:async()=>{throw Error('unexpected_save');},
   recordCashReceipt:async()=>{stored=mutated;return true;}
  });
  await assert.rejects(actions.recordFarePayment('cash-preserve','cash',1250),/cash_receipt_not_committed/);
 }
});
test('SumUp confirmation must not silently complete the ride',async()=>{
 const course={id:'sumup-preserve',status:'scheduled'};
 let stored=course;
 const actions=createCourseActions({
  getCourse:async()=>stored,
  saveCourse:async next=>{stored={...next,status:'completed'};return true;},
  recordCashReceipt:async()=>true,
  verifySumUpTransaction:async()=>true
 });
 await assert.rejects(actions.recordFarePayment(course.id,'sumup',1250,'verified-ref'),/sumup_payment_not_committed/);
});
