// Pure state transitions for Mon Taxi. No UI, storage, or SumUp side effects.
// Payment is independent from course completion.
export function registerPayment(course, payment) {
  if (!course || !course.id) throw new Error('course_required');
  if (course.status === 'completed' || course.status === 'cancelled') throw new Error('course_not_in_planning');
  if (!payment || !['cash', 'sumup', 'other'].includes(payment.method)) throw new Error('invalid_method');
  // Les centimes sont acceptés, mais pas les fractions de centime.
  if (!Number.isSafeInteger(payment.amountCents) || payment.amountCents < 0) throw new Error('invalid_amount');
  if (course.payment?.status === 'pending' && !(payment.method === 'sumup' && payment.confirmed === true && payment.reference)) throw new Error('payment_pending_verification');
  if (course.payment?.status === 'paid') {
    if (course.payment.method === 'sumup' && payment.method === 'sumup' &&
        course.payment.reference && payment.reference === course.payment.reference &&
        payment.amountCents === course.payment.amountCents && payment.confirmed === true) return course;
    throw new Error('already_paid');
  }
  if (payment.method === 'sumup' && (payment.confirmed !== true || !payment.reference)) {
    throw new Error('sumup_confirmation_required');
  }
  return {
    ...course,
    payment: {
      status: 'paid',
      method: payment.method,
      amountCents: payment.amountCents,
      reference: payment.reference ?? null
    }
  };
}
// A SumUp checkout request is not proof of payment.
export function markPaymentPending(course, method = 'sumup') {
  if (!course || !course.id) throw new Error('course_required');
  if (course.status === 'completed' || course.status === 'cancelled') throw new Error('course_not_in_planning');
  if (method !== 'sumup') throw new Error('unsupported_pending_method');
  if (course.payment?.status === 'paid') throw new Error('already_paid');
  if (course.payment?.status === 'pending') return course;
  return { ...course, payment: { status: 'pending', method, amountCents: null, reference: null } };
}
export function markPaymentFailed(course) {
  if (!course || !course.id) throw new Error('course_required');
  if (course.payment?.status === 'paid') throw new Error('already_paid');
  if (course.status === 'completed' || course.status === 'cancelled') throw new Error('course_not_in_planning');
  if (course.payment?.status !== 'pending') return course;
  return { ...course, payment: { ...course.payment, status: 'failed' } };
}
export function completeCourseFromPlanning(course) {
  if (!course || !course.id) throw new Error('course_required');
  if (course.status === 'completed') return course;
  if (course.status === 'cancelled') throw new Error('cancelled_course');
  return { ...course, status: 'completed' };
}
export function planningCourses(courses) {
  return courses.filter(course => course.status !== 'completed' && course.status !== 'cancelled');
}
