-- Independent refund reservation: only the service role can reserve; no client policy.
create table if not exists public.taxi_refund_reservations(
 merchant_code text not null, transaction_id text not null, attempt_id text not null,
 reference text not null, amount_cents integer not null check(amount_cents>0),
 created_at timestamptz not null default now(),
 primary key(merchant_code,transaction_id),unique(merchant_code,attempt_id)
);
alter table public.taxi_refund_reservations enable row level security;
revoke all on public.taxi_refund_reservations from anon,authenticated,public;
grant select,insert on public.taxi_refund_reservations to service_role;
