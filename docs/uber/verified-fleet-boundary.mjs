// Fail-closed adapter boundary for a verified Uber Fleet Supplier response.
// Only server-side code that has verified the Uber authorization and driver membership
// may call this adapter. Never accept provenance flags from a browser or uploaded JSON.
import { normalizeUberEarning } from './earnings-reconciliation.mjs';

export function mapVerifiedFleetEarnings(events, context) {
  if (!context || context.serverVerified !== true ||
      context.provider !== 'uber-fleet-supplier' ||
      typeof context.authorizedDriverId !== 'string' ||
      !context.authorizedDriverId.trim() ||
      typeof context.fleetId !== 'string' || !context.fleetId.trim()) {
    throw new Error('Verified Fleet Supplier authorization required');
  }
  if (!Array.isArray(events)) throw new Error('Events must be an array');
  return events.map(event => {
    if (!event || event.driverId !== context.authorizedDriverId)
      throw new Error('Fleet driver mismatch');
    // This is an internal normalized contract, not a claim about Uber API field names.
    // The upstream official API adapter must map its documented fields explicitly.
    return normalizeUberEarning({...event, source:'uber-official'});
  });
}
