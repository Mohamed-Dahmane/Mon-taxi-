import test from 'node:test';
import assert from 'node:assert/strict';
import {mapVerifiedFleetEarnings} from '../docs/uber/verified-fleet-boundary.mjs';
import {reconcileUberEarnings} from '../docs/uber/earnings-reconciliation.mjs';

const authorization = Object.freeze({
  serverVerified:true, provider:'uber-fleet-supplier',
  authorizedDriverId:'driver-A', fleetId:'fleet-A'
});
const earning = Object.freeze({
  driverId:'driver-A', eventId:'fare-1', tripId:'trip-1',
  eventType:'fare', amountCents:2500, currency:'EUR',
  occurredAt:'2026-11-12T08:00:00Z', source:'untrusted-browser'
});

test('server-side boundary overrides a forged source without mutating input', () => {
  const original = JSON.stringify(earning);
  const [mapped] = mapVerifiedFleetEarnings([earning], authorization);
  assert.equal(mapped.source, 'uber-official');
  assert.equal(JSON.stringify(earning), original);
  assert.ok(Object.isFrozen(mapped));
});

test('replayed verified event stays pending and never increases total twice', () => {
  const mapped = mapVerifiedFleetEarnings([earning, earning], authorization);
  const result = reconcileUberEarnings(mapped);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.duplicates, 1);
  assert.equal(result.totalCents, 2500);
  assert.equal(result.accepted[0].status, 'pending_review');
  const replay = reconcileUberEarnings(mapped, [result.accepted[0].idempotencyKey]);
  assert.equal(replay.accepted.length, 0);
  assert.equal(replay.totalCents, 0);
});

test('cross-driver batch is rejected without producing partial results', () => {
  assert.throws(() => mapVerifiedFleetEarnings([
    earning, {...earning, driverId:'driver-B', eventId:'fare-2'}
  ], authorization), /driver mismatch/);
});
