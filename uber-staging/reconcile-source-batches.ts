/**
 * Read-only admission gate for an authorized Uber daily earnings preview.
 * No database calls, OAuth tokens, or writes to Mon Taxi "Appli".
 * A caller must verify driver/fleet authorization on the server.
 */
import { previewDailyUberEarnings, type DailyUberPreview } from "./preview-daily-earnings";
import type { UberEventInput } from "./normalize-uber-event";

export type AuthorizedBatch = {
  source: UberEventInput["source"];
  driverId: string;
  /** A source export may be incomplete; never interpret a partial page as a daily total. */
  complete: boolean;
  /** Inclusive source coverage window, local dates in Brussels. */
  firstServiceDate: string;
  lastServiceDate: string;
  events: UberEventInput[];
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function validServiceDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Refuses partial data, gaps in coverage, mixed source batches and foreign drivers.
 * Overlapping API/export sources must be reconciled separately; never sum them.
 * This is only a preview: manual Appli amounts must remain authoritative.
 */
export function previewAuthorizedDailyBatch(
  batch: AuthorizedBatch,
  requestedDate: string,
  authorizedDriverId: string
): DailyUberPreview {
  if (!validServiceDate(requestedDate) || !validServiceDate(batch.firstServiceDate) || !validServiceDate(batch.lastServiceDate))
    throw new Error("Invalid Brussels service date");
  if (batch.firstServiceDate > batch.lastServiceDate)
    throw new Error("Reversed source coverage window");
  if (!batch.complete || batch.firstServiceDate > requestedDate || batch.lastServiceDate < requestedDate)
    throw new Error("Incomplete source coverage for requested date");
  if (!authorizedDriverId || batch.driverId !== authorizedDriverId)
    throw new Error("Driver ownership mismatch");
  if (batch.events.some(e => e.source !== batch.source || e.driverId !== authorizedDriverId))
    throw new Error("Mixed source or foreign driver");
  const previews = previewDailyUberEarnings(batch.events, authorizedDriverId);
  if (previews.some(p => p.serviceDateBrussels < batch.firstServiceDate || p.serviceDateBrussels > batch.lastServiceDate))
    throw new Error("Event outside declared source coverage");
  return previews.find(p => p.serviceDateBrussels === requestedDate) ?? {
    driverId: authorizedDriverId, serviceDateBrussels: requestedDate, amountCents: 0, eventCount: 0
  };
}
