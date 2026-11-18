-- Preparation only: do NOT apply without reviewed migration and backup.
-- Atomic one-time OAuth state consumption for taxi-uber-oauth.
-- Existing callback currently SELECTs then DELETEs; concurrent callbacks can reuse a state.
-- Function returns the user only for an unexpired state, deleting it in the same statement.
-- Invoke via a privileged server-side client only; never expose service role keys.
create or replace function public.taxi_uber_consume_oauth_state(p_state_hash text)
returns table(user_id uuid)
language sql
security definer
set search_path = ''
as $$
  delete from public.taxi_uber_oauth_states s
  where s.state_hash = p_state_hash
    and s.created_at > now() - interval '10 minutes'
  returning s.user_id;
$$;
revoke all on function public.taxi_uber_consume_oauth_state(text) from public, anon, authenticated;
grant execute on function public.taxi_uber_consume_oauth_state(text) to service_role;

-- Callback replacement proposal:
-- const {data, error} = await admin.rpc("taxi_uber_consume_oauth_state", {p_state_hash: stateHash});
-- if(error || !data?.length) return json({error:"Invalid, expired or used authorization state"},400);
-- const userId = data[0].user_id;
-- Remove the previous SELECT + DELETE pair; do not log OAuth codes, tokens or state.
-- Deployment prerequisites: database backup verified restorable, migration reviewed,
-- tests for concurrent callback, expired state and replay, official Uber access granted.
