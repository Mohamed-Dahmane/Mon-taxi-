/**
 * Isolated Uber earnings event normalizer. NOT connected to production or Appli.
 * Accept only records obtained through an authorized Uber API/export.
 * Caller MUST verify user-to-driver/fleet ownership server-side before using.
 */
export type UberEventInput = {
  source: "uber_fleet_supplier" | "uber_authorized_export";
  externalEventId: string;
  tripId?: string;
  driverId: string;
  occurredAt: string;
  currency: string;
  amountCents: number;
  eventKind: "trip_earning" | "adjustment" | "reversal";
  originalEventId?: string;
};
export type NormalizedUberEvent = UberEventInput & {
  eventKey: string;
  serviceDateBrussels: string;
};
const ID = /^[A-Za-z0-9._:-]{1,180}$/;
const money = (n: number) => Number.isSafeInteger(n) && Math.abs(n) <= 100_000_000;
export function normalizeUberEvent(input: UberEventInput): NormalizedUberEvent {
  if (!["uber_fleet_supplier", "uber_authorized_export"].includes(input.source))
    throw new Error("Unsupported source");
  if (![input.externalEventId, input.driverId].every(x => typeof x === "string" && ID.test(x)))
    throw new Error("Missing/invalid stable event or driver identifier");
  if (input.tripId !== undefined && !ID.test(input.tripId))
    throw new Error("Invalid trip ID");
  if (input.currency !== "EUR" || !money(input.amountCents))
    throw new Error("Invalid EUR integer-cent amount");
  if (!["trip_earning", "adjustment", "reversal"].includes(input.eventKind))
    throw new Error("Unsupported event kind");
  if (input.eventKind === "trip_earning" && input.amountCents < 0)
    throw new Error("Negative trip earnings must be represented as an adjustment or reversal");
  if (input.eventKind === "trip_earning" && !input.tripId)
    throw new Error("Trip earnings require trip ID");
  if (input.eventKind !== "trip_earning" && (!input.originalEventId || !ID.test(input.originalEventId)))
    throw new Error("Corrections require original event ID");
  if (input.eventKind !== "trip_earning" && input.originalEventId === input.externalEventId)
    throw new Error("Correction cannot reference itself");
  if (input.eventKind === "reversal" && input.amountCents > 0)
    throw new Error("Reversal must not be positive");
  if (typeof input.occurredAt !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.occurredAt))
    throw new Error("Timestamp must include timezone");
  const d = new Date(input.occurredAt);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid timestamp");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(d);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  const serviceDateBrussels = `${part("year")}-${part("month")}-${part("day")}`;
  return { ...input, eventKey: [input.source, input.driverId, input.externalEventId].map(x => `${x.length}:${x}`).join("|"), serviceDateBrussels };
}
/** Pure in-memory replay filter for tests/previews, NOT a database uniqueness guarantee. */
export function uniqueEvents(events: NormalizedUberEvent[]): NormalizedUberEvent[] {
  const seen = new Map<string, NormalizedUberEvent>();
  // A trip may be present in both Fleet Supplier and an authorized export.
  // Never silently add both sources to a daily total.
  const tripOwners = new Map<string, string>();
  for (const event of events) {
    if (event.eventKind === "trip_earning" && event.tripId) {
      const tripKey = [event.driverId, event.tripId].map(x => `${x.length}:${x}`).join("|");
      const previousEventKey = tripOwners.get(tripKey);
      if (previousEventKey && previousEventKey !== event.eventKey)
        throw new Error("Ambiguous duplicate trip across earnings events: " + tripKey);
      tripOwners.set(tripKey, event.eventKey);
    }
    const old = seen.get(event.eventKey);
    if (old && JSON.stringify(old) !== JSON.stringify(event))
      throw new Error("Conflicting replay: " + event.eventKey);
    seen.set(event.eventKey, event);
  }
  return [...seen.values()];
}
