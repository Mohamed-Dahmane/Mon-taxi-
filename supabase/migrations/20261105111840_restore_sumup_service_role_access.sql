-- Restore access for the trusted sync backend; anonymous access stays revoked.
grant usage on schema public to service_role;
grant select, insert, update on public.taxi_sumup_transactions to service_role;
grant select on public.taxi_sumup_daily_totals to service_role;
