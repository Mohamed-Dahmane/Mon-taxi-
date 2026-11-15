import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSourceMixing } from './uber-source-mixing-gate.mjs';

const event = (overrides={}) => ({
  source:'fleet', fleetId:'fleet-1', driverId:'driver-1',
  eventId:'trip-1', eventType:'trip', currency:'EUR', amountMinor:1250,
  ...overrides
});

test('mixed Fleet and statement events for same driver are held, not accepted', () => {
  const result=auditSourceMixing([event(),event({source:'statement',eventId:'statement-99'})]);
  assert.equal(result.acceptedForReview.length,0);
  assert.equal(result.mixedDrivers.length,1);
  assert.equal(result.writesPerformed,0);
});

test('separate drivers remain isolated', () => {
  const result=auditSourceMixing([event(),event({source:'statement',driverId:'driver-2'})]);
  assert.equal(result.acceptedForReview.length,2);
  assert.equal(result.mixedDrivers.length,0);
});

test('separate fleets remain isolated', () => {
  const result=auditSourceMixing([event(),event({source:'statement',fleetId:'fleet-2'})]);
  assert.equal(result.acceptedForReview.length,2);
});

test('payouts do not trigger source mixing or count as income', () => {
  const result=auditSourceMixing([event(),event({source:'statement',eventType:'payout',eventId:'payout-1'})]);
  assert.equal(result.acceptedForReview.length,1);
  assert.equal(result.excluded.length,1);
  assert.equal(result.mixedDrivers.length,0);
});

test('input is not mutated', () => {
  const input=[event(),event({source:'statement',eventId:'different'})];
  const before=JSON.stringify(input);
  auditSourceMixing(input);
  assert.equal(JSON.stringify(input),before);
});
