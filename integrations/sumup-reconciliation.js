// SumUp transaction reconciliation for Mon Taxi V11.
// Pure calculation module. No API credentials, network calls, or browser storage.
// Transactions must come from a trusted backend; never call SumUp with a secret from browser JS.
export function sumupDailyTotals(transactions) {
  const days = new Map();
  const seen = new Set();
  for (const tx of transactions) {
    if (!tx || !tx.id || seen.has(tx.id)) continue;
    seen.add(tx.id);
    // Only successful payments contribute to turnover; refunds are accounted separately.
    if (tx.status !== "SUCCESSFUL" || !tx.timestamp) continue;
    const amount = Number(tx.amount);
    if (!Number.isFinite(amount) || amount < 0 || tx.currency !== "EUR") continue;
    // Explicit business-local day supplied by backend; avoids timezone shifts.
    const date = tx.localDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) continue;
    const cents = Math.round(amount * 100);
    days.set(date, (days.get(date) || 0) + cents);
  }
  return Object.fromEntries([...days].map(([date, cents]) => [date, cents / 100]));
}
export function taxiCashbox({ card = 0, cash = 0, apbs = 0, commissions = 0 }) {
  const toCents = x => Math.round(Number(x || 0) * 100);
  return (toCents(card) + toCents(cash) + toCents(apbs) - toCents(commissions)) / 100;
}
