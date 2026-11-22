import { registerPayment, completeCourseFromPlanning } from './course-payment-state.mjs';

// Adapter for the host application. Persistence is injected so this module never
// touches real financial data until the host provides its own atomic save operation.
export function createCourseActions({ getCourse, saveCourse, recordCashReceipt, verifySumUpTransaction, completeCourseAtomically }) {
  if (![getCourse, saveCourse, recordCashReceipt].every(fn => typeof fn === 'function')) {
    throw new Error('course_action_dependencies_required');
  }
  // Same-process guard: prevent double taps from racing before persistence.
  // The host must still enforce uniqueness atomically across devices/processes.
  const inFlight = new Set();
  async function guarded(courseId, work) {
    const key = String(courseId);
    if (inFlight.has(key)) throw new Error('course_operation_in_progress');
    inFlight.add(key);
    try { return await work(); }
    finally { inFlight.delete(key); }
  }
  return {
    async recordFarePayment(courseId, method, amountCents, reference) {
      return guarded(courseId, async () => {
      const course = await getCourse(courseId);
      if (!course) throw new Error('course_not_found');
      // Reject invalid cent values before calling the cash ledger or SumUp verifier.
      if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error('invalid_amount');
      if (method !== 'cash' && method !== 'sumup') throw new Error('unsupported_payment_method');
      if (course.payment?.status === 'paid') throw new Error('already_paid');
      if (course.status === 'completed' || course.status === 'cancelled') throw new Error('course_not_in_planning');
      if (course.payment?.status === 'pending' && method !== 'sumup') throw new Error('payment_pending_verification');
      if (method === 'cash') {
        // Cash accounting and course payment must be committed together by the host.
        // The host callback must be idempotent using courseId as its unique key.
        const next = registerPayment(course, { method, amountCents });
        // The host must atomically commit both the cash receipt and course state.
        // A separate save after cash recording risks double accounting on retry.
        const recorded = await recordCashReceipt({ courseId, amountCents, course: next });
        if (recorded !== true) throw new Error('cash_receipt_not_recorded');
        const persisted = await getCourse(courseId);
        if (!persisted || persisted.id !== courseId ||
            persisted.payment?.status !== 'paid' ||
            persisted.payment.method !== 'cash' ||
            persisted.payment.amountCents !== amountCents ||
            persisted.status !== course.status) {
          throw new Error('cash_receipt_not_committed');
        }
        return { recorded: true, course: persisted };
      }
      if (method === 'sumup') {
        if (!reference) throw new Error(course.payment?.status === 'pending' ? 'payment_pending_verification' : 'sumup_confirmation_required');
        if (typeof verifySumUpTransaction !== 'function') throw new Error('sumup_verifier_unavailable');
        const verified = await verifySumUpTransaction({ courseId, amountCents, reference });
        if (verified !== true) throw new Error('sumup_payment_not_verified');
        const next = registerPayment(course, {
          method, amountCents, reference, confirmed: true
        });
        const saved = await saveCourse(next);
        if (saved === false) throw new Error('sumup_payment_not_committed');
        // A successful remote charge must not be reported as locally recorded
        // unless the host can read the same paid state back from persistence.
        const persisted = await getCourse(courseId);
        if (!persisted || persisted.id !== courseId ||
            persisted.status !== course.status ||
            persisted.payment?.status !== 'paid' ||
            persisted.payment.method !== 'sumup' ||
            persisted.payment.reference !== reference ||
            persisted.payment.amountCents !== amountCents) {
          throw new Error('sumup_payment_not_committed');
        }
        return { recorded: true, course: persisted };
      }
      throw new Error('unsupported_payment_method');
      });
    },
    async completeFromPlanning(courseId) {
      return guarded(courseId, async () => {
      const course = await getCourse(courseId);
      if (!course) throw new Error('course_not_found');
      const next = completeCourseFromPlanning(course);
      if (next === course) return next;
      if (typeof completeCourseAtomically === 'function') {
        const saved = await completeCourseAtomically({ courseId, previous: course, course: next });
        if (saved !== true) throw new Error('course_completion_not_committed');
      } else {
        const saved = await saveCourse(next);
        if (saved === false) throw new Error('course_completion_not_committed');
      }
      const persisted = await getCourse(courseId);
      if (!persisted || persisted.status !== 'completed') throw new Error('course_completion_not_committed');
      return persisted;
      });
    }
  };
}
