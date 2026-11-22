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
