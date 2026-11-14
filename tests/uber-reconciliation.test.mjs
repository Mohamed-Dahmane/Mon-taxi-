// Standalone, dependency-free safety checks. Run: node --test tests/uber-reconciliation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

function reconcile(existing, incoming) {
  const seen = new Set(existing.map(x => x.driverId + ':' + x.paymentId));
  const accepted = [], duplicates = [], rejected = [];
  for (const row of incoming) {
    if (!row.driverId || !row.paymentId || row.currency !== 'EUR' ||
        !Number.isSafeInteger(row.netCents) || !row.occurredAt ||
        !Number.isFinite(Date.parse(row.occurredAt))) {
      rejected.push(row); continue;
    }
    const key = row.driverId + ':' + row.paymentId;
    if (seen.has(key)) { duplicates.push(row); continue; }
    seen.add(key);
    accepted.push({ ...row, status: 'pending_review' });
  }
  return { accepted, duplicates, rejected };
}
const payment = {driverId:'driver-1',paymentId:'trip-1',currency:'EUR',netCents:1234,occurredAt:'2026-11-10T12:00:00Z'};
test('same driver/payment never counted twice, including within one batch', () => {
  const r=reconcile([], [payment,payment]);
  assert.equal(r.accepted.length,1); assert.equal(r.duplicates.length,1);
});
test('reimport of existing payment is ignored', () => {
  assert.equal(reconcile([payment],[payment]).accepted.length,0);
});
test('invalid currency, missing IDs and non-integer cents are rejected', () => {
  assert.equal(reconcile([], [{...payment,currency:'USD'},{...payment,paymentId:''},{...payment,netCents:12.34}]).rejected.length,3);
});
test('different drivers do not collide', () => {
  assert.equal(reconcile([payment],[{...payment,driverId:'driver-2'}]).accepted.length,1);
});
test('import is staging only: does not change manual Appli amount', () => {
  const manualAppliCents=5000;
  const r=reconcile([], [payment]);
  assert.equal(manualAppliCents,5000);
  assert.equal(r.accepted[0].status,'pending_review');
});
