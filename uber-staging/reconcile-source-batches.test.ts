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
