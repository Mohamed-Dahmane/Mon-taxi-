/** Uber payment normalization: pure staging helper, NOT wired to production.
 * Only consume records from an officially authorized endpoint.
 * Amounts must be net driver earnings in EUR, never gross fleet revenue.
 */
export type UberDriverPayment = {
  provider: "uber";
  driverId: string;
  paymentId: string;
  occurredAt: string;
  amountCents: number;
  currency: "EUR";
  status: "pending" | "settled" | "reversed";
};
export function normalizeUberPayment(input: unknown): UberDriverPayment {
  if (!input || typeof input !== "object") throw Error("Invalid payment");
  const p = input as Record<string, unknown>;
  const driverId = p.driverId, paymentId = p.paymentId;
  if (typeof driverId !== "string" || !driverId.trim() ||
      typeof paymentId !== "string" || !paymentId.trim()) throw Error("Stable driver/payment IDs required");
  if (p.currency !== "EUR") throw Error("Unexpected currency");
  if (typeof p.amountCents !== "number" || !Number.isSafeInteger(p.amountCents))
    throw Error("Amount must be exact integer cents");
  if (typeof p.occurredAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(p.occurredAt) ||
      !Number.isFinite(Date.parse(p.occurredAt))) throw Error("Timestamp with timezone required");
  // Reject calendar rollovers (e.g. February 30) and impossible offsets.
  const match = p.occurredAt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/);
  if (!match) throw Error("Invalid timestamp");
  const [, year, month, day, hour, minute, second, zone, , offsetHour, offsetMinute] = match;
  const utcCalendar = new Date(Date.UTC(+year, +month - 1, +day));
  if (utcCalendar.getUTCFullYear() !== +year || utcCalendar.getUTCMonth() + 1 !== +month ||
      utcCalendar.getUTCDate() !== +day || +hour > 23 || +minute > 59 || +second > 59 ||
      (zone !== "Z" && (+offsetHour > 23 || +offsetMinute > 59))) throw Error("Invalid timestamp components");
  if (p.status !== "pending" && p.status !== "settled" && p.status !== "reversed")
    throw Error("Unknown payment status");
  return { provider:"uber", driverId, paymentId, occurredAt:p.occurredAt,
    amountCents:p.amountCents, currency:"EUR", status:p.status };
}
/** The staging deduplication key MUST include both driver and payment IDs. */
export function uberPaymentKey(p: UberDriverPayment): string {
  return JSON.stringify(["uber", p.driverId, p.paymentId]);
}
