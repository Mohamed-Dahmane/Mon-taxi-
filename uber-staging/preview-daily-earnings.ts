/** Read-only preview. Never writes to Supabase or the Mon Taxi "Appli" field. */
import { normalizeUberEvent, uniqueEvents, type UberEventInput } from "./normalize-uber-event";

export type DailyUberPreview = {
  driverId: string;
  serviceDateBrussels: string;
  amountCents: number;
  eventCount: number;
};

/**
 * Caller must validate authorization, driver ownership and source completeness.
 * Any ambiguous duplicate trip or conflicting replay throws: fail closed.
 * No manual "Appli" amounts may be overwritten or added to these previews
 * without an independently verified reconciliation and explicit opt-in.
 */
export function previewDailyUberEarnings(
  inputs: UberEventInput[],
  authorizedDriverId: string
): DailyUberPreview[] {
  if (!authorizedDriverId || inputs.some(e => e.driverId !== authorizedDriverId))
    throw new Error("Driver ownership mismatch");
  const events = uniqueEvents(inputs.map(normalizeUberEvent));
  // A correction is safe to preview only when its original event is present
  // in the same authorized, complete input batch. Never invent a base amount.
  const eventById = new Map(events.map(e => [`${e.source}|${e.driverId}|${e.externalEventId}`, e]));
  for (const event of events) {
    if (event.eventKind !== "trip_earning") {
      const original = eventById.get(`${event.source}|${event.driverId}|${event.originalEventId}`);
      if (!original) throw new Error("Orphan financial correction");
      if (original.eventKind !== "trip_earning") throw new Error("Correction must reference original trip earning");
      if (event.tripId && event.tripId !== original.tripId) throw new Error("Correction trip mismatch");
      if (event.serviceDateBrussels !== original.serviceDateBrussels)
        throw new Error("Cross-day correction requires explicit reconciliation");
    }
  }
  const totals = new Map<string, DailyUberPreview>();
  for (const event of events) {
    const day = event.serviceDateBrussels;
    const current = totals.get(day) ?? {
      driverId: authorizedDriverId, serviceDateBrussels: day,
      amountCents: 0, eventCount: 0
    };
    const next = current.amountCents + event.amountCents;
    if (!Number.isSafeInteger(next))
      throw new Error("Unsafe total amount");
    current.amountCents = next;
    current.eventCount++;
    totals.set(day, current);
  }
  return [...totals.values()].sort((a,b) => a.serviceDateBrussels.localeCompare(b.serviceDateBrussels));
}
