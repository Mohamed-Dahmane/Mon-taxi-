// Pure comparison helper. Never updates manual Appli or Supabase.
import { previewUberDays } from './daily-preview.mjs';
export function compareUberWithManual(rows, manualDays = [], existingKeys = []) {
  const preview = previewUberDays(rows, existingKeys);
  const manual = new Map();
  for (const item of manualDays) {
    if (!item || typeof item.driverId !== 'string' || !item.driverId.trim() ||
        typeof item.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.day) ||
        !Number.isSafeInteger(item.amountCents)) throw new Error('Invalid manual day');
    const key = JSON.stringify([item.driverId, item.day]);
    if (manual.has(key)) throw new Error('Duplicate manual day');
    manual.set(key, item.amountCents);
  }
  return {status:'preview_only', conflicts:preview.conflicts, duplicates:preview.duplicates,
    comparisons:preview.days.map(day => {
      const key = JSON.stringify([day.driverId, day.day]);
      const manualCents = manual.has(key) ? manual.get(key) : null;
      const differenceCents = manualCents === null ? null : day.totalCents - manualCents;
      if (differenceCents !== null && !Number.isSafeInteger(differenceCents))
        throw new Error('Manual comparison cents overflow');
      return {...day, manualCents, differenceCents, status:'pending_review'};
    })};
}
