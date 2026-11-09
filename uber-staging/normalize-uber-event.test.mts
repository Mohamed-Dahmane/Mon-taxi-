/** Run with: node --experimental-strip-types --test uber-staging/normalize-uber-event.test.mts (Node >=22). */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { normalizeUberEvent, uniqueEvents, type UberEventInput } from "./normalize-uber-event.ts";

const base: UberEventInput = {
  source: "uber_authorized_export", externalEventId: "evt-001",
  tripId: "trip-001", driverId: "driver-001",
  occurredAt: "2026-11-08T23:30:00Z", currency: "EUR",
  amountCents: 1250, eventKind: "trip_earning"
};
test("Brussels date crosses UTC midnight", () => {
  assert.equal(normalizeUberEvent(base).serviceDateBrussels, "2026-11-09");
});
test("DST offset changes Brussels service date correctly", () => {
  assert.equal(normalizeUberEvent({...base, occurredAt:"2026-07-01T22:30:00Z"}).serviceDateBrussels, "2026-07-02");
});
test("same event replay is idempotent in preview", () => {
  const e = normalizeUberEvent(base);
  assert.equal(uniqueEvents([e,e]).length, 1);
});
test("same source/event id with different amounts is rejected", () => {
  assert.throws(() => uniqueEvents([normalizeUberEvent(base), normalizeUberEvent({...base, amountCents:1300})]), /Conflicting replay/);
});
test("different sources do not collide", () => {
  assert.equal(uniqueEvents([normalizeUberEvent(base), normalizeUberEvent({...base,source:"uber_fleet_supplier"})]).length,2);
});
test("corrections require original event identifier", () => {
  assert.throws(() => normalizeUberEvent({...base,eventKind:"adjustment"}), /original event ID/);
  assert.equal(normalizeUberEvent({...base,eventKind:"adjustment",originalEventId:"evt-000",amountCents:-200}).amountCents,-200);
});
test("positive reversals are rejected", () => {
  assert.throws(() => normalizeUberEvent({...base,eventKind:"reversal",originalEventId:"evt-000"}), /Reversal/);
});
test("timestamps without timezone and non-EUR amounts are rejected", () => {
  assert.throws(() => normalizeUberEvent({...base,occurredAt:"2026-11-08T12:00:00"}), /timezone/);
  assert.throws(() => normalizeUberEvent({...base,currency:"USD"}), /EUR/);
});
test("fractional cents and unsafe integers are rejected", () => {
  assert.throws(() => normalizeUberEvent({...base,amountCents:12.5}), /integer-cent/);
  assert.throws(() => normalizeUberEvent({...base,amountCents:Number.MAX_SAFE_INTEGER+1}), /integer-cent/);
});

test("identical event IDs for different drivers remain distinct", () => {
  const a = normalizeUberEvent(base);
  const b = normalizeUberEvent({...base,driverId:"driver-002"});
  assert.notEqual(a.eventKey,b.eventKey);
  assert.equal(uniqueEvents([a,b]).length,2);
});

test("replayed event in a later batch does not double-count", () => {
  const firstBatch = uniqueEvents([normalizeUberEvent(base)]);
  const secondBatch = uniqueEvents([...firstBatch, normalizeUberEvent({...base})]);
  assert.equal(secondBatch.length, 1);
  assert.equal(secondBatch.reduce((sum, event) => sum + event.amountCents, 0), 1250);
});
test("same trip with distinct adjustment event is retained", () => {
  const earning = normalizeUberEvent(base);
  const adjustment = normalizeUberEvent({...base, externalEventId:"evt-adjust-001", eventKind:"adjustment", originalEventId:"evt-001", amountCents:-150});
  const events = uniqueEvents([earning, adjustment]);
  assert.equal(events.length, 2);
  assert.equal(events.reduce((sum, event) => sum + event.amountCents, 0), 1100);
});
test("missing trip ID is rejected for trip earnings", () => {
  assert.throws(() => normalizeUberEvent({...base, tripId:undefined}), /trip ID/);
});

test("separator characters in driver/event IDs cannot collide", () => {
  const a = normalizeUberEvent({...base, driverId:"driver:a", externalEventId:"event:b"});
  const b = normalizeUberEvent({...base, driverId:"driver", externalEventId:"a:event:b"});
  assert.notEqual(a.eventKey, b.eventKey);
  assert.equal(uniqueEvents([a,b]).length, 2);
});

test("adjustments and reversals cannot reference themselves", () => {
  for (const eventKind of ["adjustment", "reversal"] as const) {
    assert.throws(() => normalizeUberEvent({...base, eventKind, originalEventId:base.externalEventId, amountCents:-100}), /reference itself/);
  }
});
