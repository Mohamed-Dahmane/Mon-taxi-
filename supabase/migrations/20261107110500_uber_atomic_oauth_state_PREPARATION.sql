-- Preparatory migration only. Not applied to production.
-- Atomically consume an OAuth state; a second concurrent callback receives no row.
-- Execute as database owner after review, and keep the function inaccessible to client roles.
create or replace function public.taxi_uber_consume_oauth_state(p_state_hash text)
returns table(user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_state_hash is null or length(p_state_hash) <> 64 or p_state_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;
  return query
  delete from public.taxi_uber_oauth_states as s
  where s.state_hash = p_state_hash
    and s.created_at >= now() - interval '10 minutes'
  returning s.user_id;
end;
$$;
revoke all on function public.taxi_uber_consume_oauth_state(text) from public, anon, authenticated;
grant execute on function public.taxi_uber_consume_oauth_state(text) to service_role;
-- In taxi-uber-oauth callback, replace SELECT then DELETE with a single
-- admin.rpc('taxi_uber_consume_oauth_state',{p_state_hash:stateHash})
-- and require exactly one returned row before exchanging the authorization code.
-- Do not activate until callback routing and OAuth scope are verified.
