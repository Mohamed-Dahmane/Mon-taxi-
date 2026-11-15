create table if not exists public.taxi_hotel_sync (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  revision integer not null default 1 check (revision > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object')
);

alter table public.taxi_hotel_sync enable row level security;
revoke all on public.taxi_hotel_sync from public, anon, authenticated;
grant select, insert, update on public.taxi_hotel_sync to authenticated;

create policy "Read own hotel data" on public.taxi_hotel_sync
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own hotel data" on public.taxi_hotel_sync
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own hotel data" on public.taxi_hotel_sync
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
