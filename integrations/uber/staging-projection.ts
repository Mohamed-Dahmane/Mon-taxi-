import { normalizeUberPayment, uberPaymentKey, type UberDriverPayment } from "./normalize-payment.ts";

/** Read-only staging projection. Never writes to taxi daily totals or the Appli field.
 * Caller must supply records obtained via an officially authorized Uber endpoint.
 * A provider-specific adapter must first verify that amountCents represents
 * the INDIVIDUAL driver's net earnings (not fleet gross or a payout transfer).
 */
export type UberStagingRow = {
  source: "uber";
  external_payment_id: string;
  driver_external_id: string;
  occurred_at: string;
  local_service_date: string;
  currency: "EUR";
  gross_cents: null;
  fee_cents: null;
  net_cents: number;
  status: UberDriverPayment["status"];
};

const brusselsDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
});
export function toUberStagingRow(value: unknown): UberStagingRow {
  const payment = normalizeUberPayment(value);
  // Use formatToParts instead of locale-dependent string ordering.
  const parts = Object.fromEntries(
    brusselsDate.formatToParts(new Date(payment.occurredAt))
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]),
  );
  return {
    source: "uber",
    external_payment_id: payment.paymentId,
    driver_external_id: payment.driverId,
    occurred_at: payment.occurredAt,
    local_service_date: `${parts.year}-${parts.month}-${parts.day}`,
    currency: "EUR",
    gross_cents: null,
    fee_cents: null,
    net_cents: payment.amountCents,
    status: payment.status,
  };
}

/** Fail closed on conflicting duplicate IDs; exact repeats are harmless.
 * This is only an in-memory preflight: database UNIQUE + transactional upsert
 * are still mandatory for cross-run idempotency.
 */
export function prepareUberStagingBatch(values: readonly unknown[]): UberStagingRow[] {
  const seen = new Map<string, UberStagingRow>();
  for (const value of values) {
    const payment = normalizeUberPayment(value);
    const key = uberPaymentKey(payment);
    const row = toUberStagingRow(payment);
    const previous = seen.get(key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) {
      throw new Error("Conflicting duplicate Uber payment; reconcile before import");
    }
    seen.set(key, row);
  }
  return [...seen.values()];
}
