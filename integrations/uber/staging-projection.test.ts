/** Run with: deno test integrations/uber/staging-projection.test.ts
 * Pure tests; no Supabase writes, Uber credentials, or production data.
 */
import { assertEquals, assertThrows } from "jsr:@std/assert";
import { prepareUberStagingBatch, toUberStagingRow } from "./staging-projection.ts";

const base = {
  provider: "uber" as const, driverId: "driver-1", paymentId: "payment-1",
  occurredAt: "2026-10-25T00:30:00Z", amountCents: 12345,
  currency: "EUR" as const, status: "settled" as const,
};

Deno.test("converts UTC timestamp to Belgian local date across winter-time change", () => {
  assertEquals(toUberStagingRow(base).local_service_date, "2026-10-25");
  assertEquals(toUberStagingRow({...base, occurredAt:"2026-10-24T22:30:00Z"}).local_service_date, "2026-10-25");
  assertEquals(toUberStagingRow({...base, occurredAt:"2026-03-29T22:30:00Z"}).local_service_date, "2026-03-30");
});

Deno.test("exact repeat is deduplicated", () => {
  assertEquals(prepareUberStagingBatch([base, {...base}]).length, 1);
});

Deno.test("same payment ID for different drivers remains distinct", () => {
  assertEquals(prepareUberStagingBatch([base, {...base, driverId:"driver-2"}]).length, 2);
});

Deno.test("same driver/payment ID with conflicting amount is rejected", () => {
  assertThrows(() => prepareUberStagingBatch([base, {...base, amountCents:12346}]));
});

Deno.test("status changes are rejected pending explicit reconciliation", () => {
  assertThrows(() => prepareUberStagingBatch([base, {...base, status:"reversed"}]));
});

Deno.test("invalid payment data fails closed", () => {
  assertThrows(() => toUberStagingRow({...base, currency:"USD"}));
  assertThrows(() => toUberStagingRow({...base, amountCents:12.34}));
  assertThrows(() => toUberStagingRow({...base, occurredAt:"2026-10-25"}));
  assertThrows(() => toUberStagingRow({...base, paymentId:""}));
});

Deno.test("rejects impossible calendar dates and malformed UTC offsets", () => {
  assertThrows(() => toUberStagingRow({...base, occurredAt:"2026-02-30T12:00:00Z"}));
  assertThrows(() => toUberStagingRow({...base, occurredAt:"2026-11-07T25:00:00Z"}));
  assertThrows(() => toUberStagingRow({...base, occurredAt:"2026-11-07T12:00:00+25:00"}));
  assertThrows(() => toUberStagingRow({...base, occurredAt:"2026-11-07T12:00:00+01:99"}));
});
