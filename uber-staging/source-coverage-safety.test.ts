/** Additional fail-closed tests for Uber source coverage. No database writes. */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { previewAuthorizedDailyBatch, type AuthorizedBatch } from "./reconcile-source-batches";

const base: AuthorizedBatch = {
  source: "uber_fleet_supplier", driverId: "driver-1", complete: true,
  firstServiceDate: "2026-11-10", lastServiceDate: "2026-11-10", events: []
};
const event = {
  source: "uber_fleet_supplier" as const, externalEventId: "event-1", tripId: "trip-1",
  driverId: "driver-1", occurredAt: "2026-11-11T12:00:00Z",
  currency: "EUR", amountCents: 1500, eventKind: "trip_earning" as const
};
test("rejects source event outside declared certified coverage even when requested day is covered", () => {
  assert.throws(() => previewAuthorizedDailyBatch({...base, events: [event]}, "2026-11-10", "driver-1"), /Event outside declared source coverage/);
});
test("rejects foreign driver event inside otherwise authorized batch", () => {
  assert.throws(() => previewAuthorizedDailyBatch({...base, events: [{...event, driverId: "driver-2"}]}, "2026-11-10", "driver-1"), /Mixed source or foreign driver/);
});
test("rejects empty authorized driver identity even if batch declares a driver", () => {
  assert.throws(() => previewAuthorizedDailyBatch(base, "2026-11-10", ""), /Driver ownership mismatch/);
});
