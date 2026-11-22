import test from 'node:test';
import assert from 'node:assert/strict';
import { createCourseActions } from './course-actions-adapter.mjs';

function setup(initial) {
  const courses = new Map([[initial.id, structuredClone(initial)]]);
  const receipts = new Set();
  const actions = createCourseActions({
    getCourse: async id => courses.get(id),
    saveCourse: async course => { courses.set(course.id, course); },
    recordCashReceipt: async ({courseId}) => {
      if (receipts.has(courseId)) return false;
      receipts.add(courseId);
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
