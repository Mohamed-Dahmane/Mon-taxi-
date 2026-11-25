-- Review and apply as a new, isolated migration. No existing table is changed.
begin;
create table public.taxi_receipt_oauth_v1 (
 id smallint primary key check(id=1),
 state_hash text check(state_hash is null or state_hash ~ '^[a-f0-9]{64}$'),
 state_expires_at timestamptz,
 token_envelope text check(token_envelope is null or length(token_envelope)<=66000),
 op_id uuid,
 op_started_at timestamptz,
 start_after timestamptz not null default '-infinity',
 read_after timestamptz not null default '-infinity',
 check((op_id is null)=(op_started_at is null))
);
alter table public.taxi_receipt_oauth_v1 enable row level security;
revoke all on table public.taxi_receipt_oauth_v1 from public, anon, authenticated;
grant select, insert, update on table public.taxi_receipt_oauth_v1 to service_role;
insert into public.taxi_receipt_oauth_v1(id) values (1);
commit;
