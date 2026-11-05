-- Mon Taxi V11: private, idempotent SumUp ledger from 2026-11-01 Europe/Brussels.
-- Apply only in the owner's Supabase project. No API secrets belong in this repository.
create table if not exists public.taxi_sumup_transactions (
  transaction_id text primary key,
  transaction_time timestamptz not null,
  local_day date not null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  status text not null,
  updated_at timestamptz not null default now(),
  constraint taxi_sumup_start check (local_day >= date '2026-11-01')
);
create index if not exists taxi_sumup_day_idx on public.taxi_sumup_transactions (local_day);
alter table public.taxi_sumup_transactions enable row level security;
-- Intentionally no anon/authenticated policies: only a trusted service-role function
-- can read or write the ledger until owner authentication is explicitly configured.
revoke all on public.taxi_sumup_transactions from anon, authenticated;
create or replace view public.taxi_sumup_daily_totals
with (security_invoker = true)
as select local_day, sum(amount_cents) as amount_cents
from public.taxi_sumup_transactions
where status = 'SUCCESSFUL'
group by local_day;
revoke all on public.taxi_sumup_daily_totals from anon, authenticated;
