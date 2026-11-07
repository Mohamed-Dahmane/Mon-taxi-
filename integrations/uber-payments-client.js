/**
 * Read-only Uber Driver payments API client.
 * Requires an OAuth user access token authorized for partner.payments.
 * Keep tokens on a trusted server; never expose them in Android, browser or logs.
 */
import { uniqueUberApiPayments } from './uber-official-payments.js';

export async function fetchUberPayments({ accessToken, fromTime, toTime, fetchImpl = fetch }) {
  if (typeof accessToken !== 'string' || !accessToken.trim()) throw new Error('Uber OAuth access token required');
  if (!Number.isInteger(fromTime) || !Number.isInteger(toTime) ||
      fromTime >= toTime || toTime - fromTime > 10 * 86400) {
    throw new Error('Uber API requires a positive time range of at most 10 days');
  }
  const items = [];
  let offset = 0;
  for (let page = 0; page < 1000; page++) {
    const url = new URL('https://api.uber.com/v1/partners/payments');
    for (const [key, value] of Object.entries({ from_time: fromTime, to_time: toTime, limit: 50, offset })) {
      url.searchParams.set(key, String(value));
    }
    const response = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' }
    });
    if (!response.ok) {
      // Do not log URLs, tokens or response bodies (may contain private data).
      if (response.status === 401 || response.status === 403) throw new Error('Uber authorization missing or expired');
      if (response.status === 409) throw new Error('Uber account is not recognized as a driver');
      throw new Error('Uber payments request failed (HTTP ' + response.status + ')');
    }
    const body = await response.json();
    if (!Array.isArray(body.payments)) throw new Error('Unexpected Uber payments response');
    items.push(...body.payments);
    offset += body.payments.length;
    if (body.payments.length === 0 || offset >= Number(body.count ?? offset)) return uniqueUberApiPayments(items);
  }
  throw new Error('Uber pagination safety limit exceeded');
}
