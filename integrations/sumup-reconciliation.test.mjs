import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
const source = readFileSync(new URL('./sumup-reconciliation.js', import.meta.url), 'utf8');
const { sumupDailyTotals, taxiCashbox } = await import('data:text/javascript,' + encodeURIComponent(source));
const tx = [
  {id:'a',status:'SUCCESSFUL',timestamp:'2026-11-05T08:00:00Z',localDate:'2026-11-05',amount:12.34,currency:'EUR'},
  {id:'a',status:'SUCCESSFUL',timestamp:'2026-11-05T08:00:00Z',localDate:'2026-11-05',amount:12.34,currency:'EUR'},
  {id:'b',status:'FAILED',timestamp:'2026-11-05T09:00:00Z',localDate:'2026-11-05',amount:100,currency:'EUR'},
  {id:'c',status:'SUCCESSFUL',timestamp:'2026-11-05T09:00:00Z',localDate:'2026-11-05',amount:0.16,currency:'EUR'},
  {id:'d',status:'SUCCESSFUL',timestamp:'2026-11-06T09:00:00Z',localDate:'2026-11-06',amount:5,currency:'USD'}
];
assert.deepEqual(sumupDailyTotals(tx), {'2026-11-05':12.5});
assert.equal(taxiCashbox({card:12.34,cash:5.66,apbs:10,commissions:3}),25);
assert.equal(taxiCashbox({}),0);
console.log('Tests de calcul SumUp/APBS réussis (aucune donnée réelle).');
