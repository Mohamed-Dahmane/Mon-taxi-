/**
 * Uber earnings adapter for Mon Taxi.
 * Pure functions: no credentials, no network calls, no changes to existing totals.
 * Only ingest records from an explicitly authorized data source.
 */
export function normalizeUberEarning(record) {
  if (!record || typeof record !== "object") throw new Error("Invalid Uber record");
  const id = String(record.id ?? record.trip_id ?? "").trim();
  const timestamp = String(record.timestamp ?? record.completed_at ?? "");
  const currency = String(record.currency ?? "EUR").toUpperCase();
  const amount = Number(record.amount);
  if (!id || !timestamp || !Number.isFinite(Date.parse(timestamp))) throw new Error("Missing id or valid timestamp");
  if (currency !== "EUR" || !Number.isFinite(amount) || amount < 0) throw new Error("Invalid EUR amount");
  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 0.000001) throw new Error("Amount has more than two decimals");
  return { source: "uber", externalId: id, timestamp, currency, amountCents: cents };
}

export function deduplicateUberEarnings(records) {
  const byId = new Map();
  for (const record of records) {
    const item = normalizeUberEarning(record);
    const existing = byId.get(item.externalId);
    if (existing && (existing.amountCents !== item.amountCents || existing.timestamp !== item.timestamp)) {
      throw new Error("Conflicting Uber record: " + item.externalId);
    }
    byId.set(item.externalId, item);
  }
  return [...byId.values()];
}

export function sumUberEarningsCents(records) {
  return deduplicateUberEarnings(records).reduce((sum, item) => sum + item.amountCents, 0);
}
