create table public.taxi_directory_feed (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision >= 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);
alter table public.taxi_directory_feed enable row level security;
revoke all on public.taxi_directory_feed from public, anon, authenticated;
grant select on public.taxi_directory_feed to authenticated;
grant select, insert, update on public.taxi_directory_feed to service_role;
create policy "Read own directory feed" on public.taxi_directory_feed
  for select to authenticated using ((select auth.uid()) = user_id);

create table public.taxi_directory_publisher (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null
);
alter table public.taxi_directory_publisher enable row level security;
revoke all on public.taxi_directory_publisher from public, anon, authenticated;
grant select on public.taxi_directory_publisher to service_role;
