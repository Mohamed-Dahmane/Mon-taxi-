/** Additional isolated regression coverage; no database writes. */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { previewDailyUberEarnings } from "./preview-daily-earnings";
import type { UberEventInput } from "./normalize-uber-event";
const base: UberEventInput = {
  source: "uber_fleet_supplier", externalEventId: "evt-100", tripId: "trip-100",
  driverId: "driver-1", occurredAt: "2026-11-09T12:00:00Z",
  currency: "EUR", amountCents: 2500, eventKind: "trip_earning"
};
test("authorized correction and replay count only once", () => {
  const correction: UberEventInput = { ...base, externalEventId: "adj-100",
    eventKind: "adjustment", originalEventId: "evt-100", amountCents: -300 };
  assert.deepEqual(previewDailyUberEarnings([base, correction, correction], "driver-1"), [
    { driverId: "driver-1", serviceDateBrussels: "2026-11-09", amountCents: 2200, eventCount: 2 }
  ]);
});
test("reversal cannot increase revenue", () => {
  const reversal: UberEventInput = { ...base, externalEventId: "rev-100",
    eventKind: "reversal", originalEventId: "evt-100", amountCents: 2500 };
  assert.throws(() => previewDailyUberEarnings([base, reversal], "driver-1"), /Reversal must not be positive/);
});
test("correction cannot point to itself", () => {
  const adjustment: UberEventInput = { ...base, eventKind: "adjustment", originalEventId: "evt-100" };
  assert.throws(() => previewDailyUberEarnings([adjustment], "driver-1"), /Correction cannot reference itself/);
});
test("missing trip ID cannot enter daily totals", () => {
  const { tripId, ...withoutTrip } = base;
  assert.throws(() => previewDailyUberEarnings([withoutTrip], "driver-1"), /Trip earnings require trip ID/);
});
