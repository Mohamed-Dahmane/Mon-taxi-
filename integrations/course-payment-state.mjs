// Pure state transitions for Mon Taxi. No UI, storage, or SumUp side effects.
// Payment is independent from course completion.
export function registerPayment(course, payment) {
  if (!course || !course.id) throw new Error('course_required');
  if (!payment || !['cash', 'sumup', 'other'].includes(payment.method)) throw new Error('invalid_method');
  if (!Number.isSafeInteger(payment.amountCents) || payment.amountCents < 0) throw new Error('invalid_amount');
  if (course.payment?.status === 'paid') {
    if (course.payment.reference && payment.reference === course.payment.reference) return course;
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
export function completeCourseFromPlanning(course) {
  if (!course || !course.id) throw new Error('course_required');
  if (course.status === 'completed') return course;
  if (course.status === 'cancelled') throw new Error('cancelled_course');
  return { ...course, status: 'completed' };
}
export function planningCourses(courses) {
  return courses.filter(course => course.status !== 'completed' && course.status !== 'cancelled');
}
