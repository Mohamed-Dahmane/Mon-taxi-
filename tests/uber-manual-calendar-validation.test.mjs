import test from 'node:test';
import assert from 'node:assert/strict';
import { compareUberWithManual } from '../docs/uber/manual-appli-comparison.mjs';

test('rejects impossible manual dates before reconciliation', () => {
  for (const day of ['2026-02-29','2026-04-31','2026-13-01','2026-00-01']) {
    assert.throws(() => compareUberWithManual([], [{driverId:'driver-a',day,amountCents:0}]), /Invalid manual day/);
  }
});

test('accepts valid leap date without touching stored amounts', () => {
  const original = [{driverId:'driver-a',day:'2024-02-29',amountCents:1234}];
  const result = compareUberWithManual([], original);
  assert.equal(result.status,'preview_only');
  assert.deepEqual(original, [{driverId:'driver-a',day:'2024-02-29',amountCents:1234}]);
});
