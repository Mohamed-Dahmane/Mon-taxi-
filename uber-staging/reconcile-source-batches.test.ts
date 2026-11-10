/** Admission gate regression tests. Run with: npx tsx --test uber-staging/reconcile-source-batches.test.ts */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { previewAuthorizedDailyBatch, type AuthorizedBatch } from "./reconcile-source-batches";

const batch: AuthorizedBatch = {
  source: "uber_fleet_supplier", driverId: "driver-1", complete: true,
  firstServiceDate: "2026-11-09", lastServiceDate: "2026-11-10", events: []
};

test("rejects reversed source coverage even when requested day equals a boundary", () => {
  assert.throws(() => previewAuthorizedDailyBatch({
    ...batch, firstServiceDate: "2026-11-10", lastServiceDate: "2026-11-09"
  }, "2026-11-10", "driver-1"), /Reversed source coverage window/);
});

test("rejects partial batch before presenting zero revenue", () => {
  assert.throws(() => previewAuthorizedDailyBatch({...batch, complete: false}, "2026-11-09", "driver-1"), /Incomplete source coverage/);
});

test("rejects another driver", () => {
  assert.throws(() => previewAuthorizedDailyBatch(batch, "2026-11-09", "driver-2"), /Driver ownership mismatch/);
});

test("complete authorized empty batch returns zero preview without writing Appli", () => {
  assert.deepEqual(previewAuthorizedDailyBatch(batch, "2026-11-09", "driver-1"), {
    driverId: "driver-1", serviceDateBrussels: "2026-11-09", amountCents: 0, eventCount: 0
  });
});

test("rejects invalid calendar day instead of normalizing it", () => {
  assert.throws(() => previewAuthorizedDailyBatch(batch, "2026-02-30", "driver-1"), /Invalid Brussels service date/);
});
test("rejects a date outside the certified source coverage", () => {
  assert.throws(() => previewAuthorizedDailyBatch(batch, "2026-11-11", "driver-1"), /Incomplete source coverage/);
});
test("rejects mixed Fleet Supplier and export events", () => {
  assert.throws(() => previewAuthorizedDailyBatch({...batch, events: [{
    source: "uber_authorized_export", externalEventId: "export-1", tripId: "trip-1",
    driverId: "driver-1", occurredAt: "2026-11-09T12:00:00Z",
    currency: "EUR", amountCents: 1000, eventKind: "trip_earning"
  }]}, "2026-11-09", "driver-1"), /Mixed source or foreign driver/);
});

test("rejects invalid source coverage dates, not just invalid requested dates", () => {
  assert.throws(() => previewAuthorizedDailyBatch({
    ...batch, firstServiceDate: "2026-02-30"
  }, "2026-11-09", "driver-1"), /Invalid Brussels service date/);
  assert.throws(() => previewAuthorizedDailyBatch({
    ...batch, lastServiceDate: "2026-11-31"
  }, "2026-11-09", "driver-1"), /Invalid Brussels service date/);
});

test("rejects missing authorization identity even for an empty source batch", () => {
  assert.throws(() => previewAuthorizedDailyBatch({
    ...batch, driverId: ""
  }, "2026-11-09", ""), /Driver ownership mismatch/);
});

test("accepts a complete certified zero-day at both coverage boundaries", () => {
  for (const day of ["2026-11-09", "2026-11-10"]) {
    assert.deepEqual(previewAuthorizedDailyBatch(batch, day, "driver-1"), {
      driverId: "driver-1", serviceDateBrussels: day, amountCents: 0, eventCount: 0
    });
  }
});
