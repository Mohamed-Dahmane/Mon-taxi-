import { registerPayment, completeCourseFromPlanning } from './course-payment-state.mjs';

// Adapter for the host application. Persistence is injected so this module never
// touches real financial data until the host provides its own atomic save operation.
export function createCourseActions({ getCourse, saveCourse, recordCashReceipt }) {
  if (![getCourse, saveCourse, recordCashReceipt].every(fn => typeof fn === 'function')) {
    throw new Error('course_action_dependencies_required');
  }
  return {
    async recordFarePayment(courseId, method, amountCents, reference) {
      const course = await getCourse(courseId);
      if (!course) throw new Error('course_not_found');
      if (course.payment?.status === 'paid') throw new Error('already_paid');
      if (method === 'cash') {
        // Cash accounting and course payment must be committed together by the host.
        // The host callback must be idempotent using courseId as its unique key.
        const next = registerPayment(course, { method, amountCents });
        const recorded = await recordCashReceipt({ courseId, amountCents, course: next });
        if (recorded !== true) throw new Error('cash_receipt_not_recorded');
        await saveCourse(next);
        return { recorded: true, course: next };
      }
      if (method === 'sumup') {
        if (!reference) throw new Error('sumup_confirmation_required');
        const next = registerPayment(course, {
          method, amountCents, reference, confirmed: true
        });
        await saveCourse(next);
        return { recorded: true, course: next };
      }
      throw new Error('unsupported_payment_method');
    },
    async completeFromPlanning(courseId) {
      const course = await getCourse(courseId);
      if (!course) throw new Error('course_not_found');
      const next = completeCourseFromPlanning(course);
      await saveCourse(next);
      return next;
    }
  };
}
