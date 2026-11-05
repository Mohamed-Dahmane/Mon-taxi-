// SumUp transaction reconciliation for Mon Taxi V11.
// Pure calculation module. No API credentials, network calls, or browser storage.
// Transactions must come from a trusted backend; never call SumUp with a secret from browser JS.
export function sumupDailyTotals(transactions) {
  const days = new Map();
  const seen = new Set();
  for (const tx of transactions) {
    if (!tx || !tx.id || seen.has(tx.id)) continue;
    // Only successful payments contribute to turnover; refunds are accounted separately.
    if (tx.status !== "SUCCESSFUL" || !tx.timestamp) continue;
    const amount = Number(tx.amount);
    if (!Number.isFinite(amount) || amount < 0 || tx.currency !== "EUR") continue;
    // Explicit business-local day supplied by backend; avoids timezone shifts.
    const date = tx.localDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) continue;
    const cents = Math.round(amount * 100);
    if (!Number.isSafeInteger(cents)) continue;
    // Mark as seen only after validation; an invalid duplicate must not hide a valid payment.
    seen.add(tx.id);
    days.set(date, (days.get(date) || 0) + cents);
  }
  return Object.fromEntries([...days].map(([date, cents]) => [date, cents / 100]));
}
export function taxiCashbox({ card = 0, cash = 0, apbs = 0, commissions = 0 }) {
  const toCents = x => {
    if (x === null || x === undefined || x === "") return 0;
    if (typeof x !== "number" && typeof x !== "string") throw new TypeError("Invalid monetary amount");
    if (typeof x === "string" && !/^\\d+(?:\\.\\d{1,2})?$/.test(x)) throw new TypeError("Invalid monetary amount");
    const n = Number(x);
    if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(Math.round(n * 100))) throw new RangeError("Invalid monetary amount");
    return Math.round(n * 100);
  };
  return (toCents(card) + toCents(cash) + toCents(apbs) - toCents(commissions)) / 100;
}
