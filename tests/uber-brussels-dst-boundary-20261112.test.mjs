import test from 'node:test';
import assert from 'node:assert/strict';
import { previewUberDays } from '../docs/uber/daily-preview.mjs';

const event = (eventId, occurredAt, amountCents = 100) => ({
  source: 'uber-official', driverId: 'driver-test', eventId,
  tripId: 'trip-test', eventType: 'fare', amountCents,
  currency: 'EUR', occurredAt
});

test('Brussels spring DST: local midnight boundary stays correct', () => {
  const result = previewUberDays([
    event('spring-before', '2026-03-28T22:59:00Z'),
    event('spring-after', '2026-03-28T23:01:00Z')
  ]);
  assert.deepEqual(result.days.map(({day, totalCents}) => [day, totalCents]), [
    ['2026-03-28', 100], ['2026-03-29', 100]
  ]);
  assert.equal(result.status, 'preview_only');
});

test('Brussels autumn DST: repeated local hour belongs to one day', () => {
  const result = previewUberDays([
    event('fall-first', '2026-10-25T00:30:00Z'),
    event('fall-second', '2026-10-25T01:30:00Z')
  ]);
  assert.deepEqual(result.days.map(({day, totalCents, eventCount}) => [day, totalCents, eventCount]), [
    ['2026-10-25', 200, 2]
  ]);
});

test('Brussels autumn DST: next local midnight does not merge with prior day', () => {
  const result = previewUberDays([
    event('fall-last', '2026-10-25T22:59:00Z'),
    event('fall-next', '2026-10-25T23:01:00Z')
  ]);
  assert.deepEqual(result.days.map(({day}) => day), ['2026-10-25', '2026-10-26']);
});
