/** Regression checks for isolated Uber preview. Run with: npx tsx --test uber-staging/preview-daily-earnings.test.ts */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { previewDailyUberEarnings } from "./preview-daily-earnings";
import type { UberEventInput } from "./normalize-uber-event";

const base: UberEventInput = {
  source: "uber_fleet_supplier", externalEventId: "evt-1", tripId: "trip-1",
  driverId: "driver-1", occurredAt: "2026-11-09T23:30:00Z",
  currency: "EUR", amountCents: 1234, eventKind: "trip_earning"
};
test("Brussels date and exact replay counted once", () => {
  assert.deepEqual(previewDailyUberEarnings([base, {...base}], "driver-1"), [
    { driverId: "driver-1", serviceDateBrussels: "2026-11-10", amountCents: 1234, eventCount: 1 }
  ]);
});
test("cross-source duplicate trip fails closed", () => {
  assert.throws(() => previewDailyUberEarnings([
    base, {...base, source: "uber_authorized_export", externalEventId: "export-1"}
  ], "driver-1"), /Ambiguous duplicate trip/);
});
test("conflicting replay fails closed", () => {
  assert.throws(() => previewDailyUberEarnings([base, {...base, amountCents: 2000}], "driver-1"), /Conflicting replay/);
});
test("wrong driver fails closed", () => {
  assert.throws(() => previewDailyUberEarnings([base], "other-driver"), /Driver ownership mismatch/);
});
test("negative ordinary trip earning rejected", () => {
  assert.throws(() => previewDailyUberEarnings([{...base, amountCents: -100}], "driver-1"), /Negative trip earnings/);
});
test("DST boundary uses Brussels local calendar date", () => {
  const event = {...base, occurredAt: "2026-10-25T00:30:00Z"};
  assert.equal(previewDailyUberEarnings([event], "driver-1")[0].serviceDateBrussels, "2026-10-25");
});

test("orphan adjustment fails closed", () => {
  assert.throws(() => previewDailyUberEarnings([
    {...base, externalEventId: "adj-1", eventKind: "adjustment", originalEventId: "missing", amountCents: -100}
  ], "driver-1"), /Orphan financial correction/);
});
test("adjustment referencing event in another source fails closed", () => {
  assert.throws(() => previewDailyUberEarnings([
    base,
    {...base, source: "uber_authorized_export", externalEventId: "adj-1", eventKind: "adjustment", originalEventId: "evt-1", tripId: undefined, amountCents: -100}
  ], "driver-1"), /Orphan financial correction/);
});

test("correction cannot reference another correction", () => {
  assert.throws(() => previewDailyUberEarnings([
    base,
    {...base, externalEventId: "adj-1", eventKind: "adjustment", originalEventId: "evt-1", amountCents: -100},
    {...base, externalEventId: "adj-2", eventKind: "adjustment", originalEventId: "adj-1", amountCents: -50}
  ], "driver-1"), /Correction must reference original trip earning/);
});
test("correction with mismatched trip fails closed", () => {
  assert.throws(() => previewDailyUberEarnings([
    base, {...base, externalEventId: "adj-1", tripId: "other-trip", eventKind: "adjustment", originalEventId: "evt-1", amountCents: -100}
  ], "driver-1"), /Correction trip mismatch/);
});
test("cross-day correction requires reconciliation", () => {
  assert.throws(() => previewDailyUberEarnings([
    base, {...base, externalEventId: "adj-1", tripId: undefined, occurredAt: "2026-11-11T12:00:00Z", eventKind: "adjustment", originalEventId: "evt-1", amountCents: -100}
  ], "driver-1"), /Cross-day correction requires explicit reconciliation/);
});

test("valid adjustment changes the daily preview exactly once despite replay", () => {
  const adjustment: UberEventInput = {
    ...base, externalEventId: "adj-valid-1", eventKind: "adjustment",
    originalEventId: "evt-1", amountCents: -234
  };
  assert.deepEqual(previewDailyUberEarnings([base, adjustment, {...adjustment}], "driver-1"), [
    { driverId: "driver-1", serviceDateBrussels: "2026-11-10", amountCents: 1000, eventCount: 2 }
  ]);
});
test("different drivers cannot be aggregated in one preview", () => {
  assert.throws(() => previewDailyUberEarnings([
    base, {...base, driverId: "driver-2", externalEventId: "evt-2", tripId: "trip-2"}
  ], "driver-1"), /Driver ownership mismatch/);
});
