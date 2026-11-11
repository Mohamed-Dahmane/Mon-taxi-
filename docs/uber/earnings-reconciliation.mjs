// Pure, offline validation for a future authorized Uber earnings importer.
// Does not connect to Uber, Supabase, or the live "Appli" field.
export function normalizeUberEarning(row) {
  if (!row || typeof row !== "object") throw new Error("Missing row");
  const {source, driverId, tripId, amountCents, currency, occurredAt} = row;
  if (source !== "uber-official") throw new Error("Unverified source");
  if (typeof driverId !== "string" || !driverId.trim()) throw new Error("Missing driver");
  if (typeof tripId !== "string" || !tripId.trim()) throw new Error("Missing trip ID");
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error("Invalid cents");
  if (currency !== "EUR") throw new Error("Unexpected currency");
  if (typeof occurredAt !== "string" || !Number.isFinite(Date.parse(occurredAt)) || !/Z$|[+-]\\d{2}:\\d{2}$/.test(occurredAt)) throw new Error("Timestamp requires timezone");
  return Object.freeze({source, driverId:driverId.trim(), tripId:tripId.trim(), amountCents, currency, occurredAt});
}
export function reconcileUberEarnings(rows, existingKeys = []) {
  const seen = new Set(existingKeys);
  const accepted = [];
  let duplicates = 0;
  for (const raw of rows) {
    const row = normalizeUberEarning(raw);
    const key = JSON.stringify([row.source,row.driverId,row.tripId]);
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key); accepted.push({...row, idempotencyKey:key});
  }
  return {accepted,duplicates,totalCents:accepted.reduce((s,r)=>s+r.amountCents,0)};
}
// Never overwrite manual Appli amounts. Staged data needs explicit approval and
// reconciliation of refunds, adjustments and payout-vs-trip semantics before posting.
