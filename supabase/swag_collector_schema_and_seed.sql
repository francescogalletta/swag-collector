-- Swag Collector: full schema + demo data.
-- Exported 2026-10-23 from Supabase project pwrvfqrryikcqzoasnoo (us-east-1).
-- Idempotent: safe to run more than once in a fresh or partially set-up project.
-- Run it in the destination project's SQL editor (Dashboard > SQL Editor > New query > Run).

begin;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.swag_items (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  vendor_id     uuid not null references public.vendors(id) on delete cascade,
  swag_type     text not null,
  description   text,
  attendee_id   uuid not null,
  attendee_name text,
  created_at    timestamptz not null default now()
);

create table if not exists public.votes (
  id           uuid primary key default gen_random_uuid(),
  swag_item_id uuid not null references public.swag_items(id) on delete cascade,
  attendee_id  uuid not null,
  rating       integer not null check (rating >= 1 and rating <= 5),
  created_at   timestamptz not null default now(),
  unique (swag_item_id, attendee_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create unique index if not exists vendors_event_name_idx on public.vendors (event_id, lower(name));
create index if not exists swag_items_event_idx  on public.swag_items (event_id, created_at desc);
create index if not exists swag_items_vendor_idx on public.swag_items (vendor_id);
create index if not exists votes_item_idx        on public.votes (swag_item_id);

-- ---------------------------------------------------------------------------
-- Row-level security: anonymous read + insert everywhere, update on votes
-- ---------------------------------------------------------------------------

alter table public.events     enable row level security;
alter table public.vendors    enable row level security;
alter table public.swag_items enable row level security;
alter table public.votes      enable row level security;

drop policy if exists "public read events"    on public.events;
drop policy if exists "public insert events"  on public.events;
drop policy if exists "public read vendors"   on public.vendors;
drop policy if exists "public insert vendors" on public.vendors;
drop policy if exists "public read swag"      on public.swag_items;
drop policy if exists "public insert swag"    on public.swag_items;
drop policy if exists "public read votes"     on public.votes;
drop policy if exists "public insert votes"   on public.votes;
drop policy if exists "public update votes"   on public.votes;

create policy "public read events"    on public.events     for select to anon, authenticated using (true);
create policy "public insert events"  on public.events     for insert to anon, authenticated with check (true);
create policy "public read vendors"   on public.vendors    for select to anon, authenticated using (true);
create policy "public insert vendors" on public.vendors    for insert to anon, authenticated with check (true);
create policy "public read swag"      on public.swag_items for select to anon, authenticated using (true);
create policy "public insert swag"    on public.swag_items for insert to anon, authenticated with check (true);
create policy "public read votes"     on public.votes      for select to anon, authenticated using (true);
create policy "public insert votes"   on public.votes      for insert to anon, authenticated with check (true);
create policy "public update votes"   on public.votes      for update to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Views (security_invoker so RLS of the caller applies)
-- ---------------------------------------------------------------------------

create or replace view public.swag_item_ratings with (security_invoker = true) as
select s.id as swag_item_id,
       s.event_id,
       s.vendor_id,
       v.name as vendor_name,
       s.swag_type,
       s.description,
       s.attendee_name,
       s.created_at,
       count(vt.id) as votes,
       round(avg(vt.rating), 2) as avg_rating
from public.swag_items s
join public.vendors v on v.id = s.vendor_id
left join public.votes vt on vt.swag_item_id = s.id
group by s.id, v.name;

create or replace view public.vendor_leaderboard with (security_invoker = true) as
select v.id as vendor_id,
       v.event_id,
       v.name as vendor_name,
       count(distinct s.id) as items_logged,
       count(vt.id) as votes,
       round(avg(vt.rating), 2) as avg_rating
from public.vendors v
left join public.swag_items s on s.vendor_id = v.id
left join public.votes vt on vt.swag_item_id = s.id
group by v.id, v.event_id, v.name;

create or replace view public.swag_type_counts with (security_invoker = true) as
select event_id, swag_type, count(*) as total
from public.swag_items
group by event_id, swag_type;

-- ---------------------------------------------------------------------------
-- Grants (Supabase default privileges normally cover these; explicit for safety)
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select, insert on public.events, public.vendors, public.swag_items to anon, authenticated;
grant select, insert, update on public.votes to anon, authenticated;
grant select on public.swag_item_ratings, public.vendor_leaderboard, public.swag_type_counts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vendors') then
    alter publication supabase_realtime add table public.vendors;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'swag_items') then
    alter publication supabase_realtime add table public.swag_items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'votes') then
    alter publication supabase_realtime add table public.votes;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Data: the demo event and the dummy attendees' swag and votes
-- Attendee ids 00000000-0000-4000-8000-00000000000{1..8}:
--   1 Alice, 2 Bob, 3 Carla, 4 Dmitri, 5 Elena, 6 Farid, 7 (anonymous), 8 Hanna
-- ---------------------------------------------------------------------------

insert into public.events (id, slug, name, created_at) values
('175fed6e-6e2e-481d-91be-d549b827914b', 'demo', 'Demo Conference 2026', '2026-10-14 15:49:53.126668+00')
on conflict (id) do nothing;

insert into public.vendors (id, event_id, name, created_at) values
('fac254c6-f756-4304-9782-be8d941e1b1f', '175fed6e-6e2e-481d-91be-d549b827914b', 'Supabase', '2026-10-21 11:57:52.22818+00'),
('73badb5f-edfe-4af6-aa42-2cc6bff0eeed', '175fed6e-6e2e-481d-91be-d549b827914b', 'Vercel', '2026-10-21 12:07:52.22818+00'),
('0995f894-e7ab-4ef7-98a7-0963db2483c6', '175fed6e-6e2e-481d-91be-d549b827914b', 'GitHub', '2026-10-21 12:17:52.22818+00'),
('d4097113-2e2a-41bf-92f1-3b42d032140a', '175fed6e-6e2e-481d-91be-d549b827914b', 'Cloudflare', '2026-10-21 12:27:52.22818+00'),
('1d528799-2ff0-4b48-8862-7d3ff38f8877', '175fed6e-6e2e-481d-91be-d549b827914b', 'Datadog', '2026-10-21 12:37:52.22818+00'),
('e093d0cb-759c-418a-91ee-2c091b3611bf', '175fed6e-6e2e-481d-91be-d549b827914b', 'Stripe', '2026-10-21 12:47:52.22818+00')
on conflict (id) do nothing;

insert into public.swag_items (id, event_id, vendor_id, swag_type, description, attendee_id, attendee_name, created_at) values
('0cdd10b3-ed66-4519-bab1-aa1348c6b8b5', '175fed6e-6e2e-481d-91be-d549b827914b', 'fac254c6-f756-4304-9782-be8d941e1b1f', 'T-shirt', 'Black tee with the lightning bolt', '00000000-0000-4000-8000-000000000001', 'Alice', '2026-10-21 12:57:52.22818+00'),
('02e892bd-84cd-42fb-8d74-37a1b3ec5abd', '175fed6e-6e2e-481d-91be-d549b827914b', 'fac254c6-f756-4304-9782-be8d941e1b1f', 'Sticker', 'Holographic sticker pack', '00000000-0000-4000-8000-000000000002', 'Bob', '2026-10-21 13:02:52.22818+00'),
('8a51b5c8-36c1-4e94-857a-51ae513ce183', '175fed6e-6e2e-481d-91be-d549b827914b', 'fac254c6-f756-4304-9782-be8d941e1b1f', 'Hoodie', 'Green zip hoodie, very soft', '00000000-0000-4000-8000-000000000003', 'Carla', '2026-10-21 13:07:52.22818+00'),
('9e5068ab-61f4-4102-9013-b114ef3259a5', '175fed6e-6e2e-481d-91be-d549b827914b', '73badb5f-edfe-4af6-aa42-2cc6bff0eeed', 'Hat', 'Black cap with the triangle', '00000000-0000-4000-8000-000000000004', 'Dmitri', '2026-10-21 13:12:52.22818+00'),
('a56555ff-ec38-42eb-a558-29e0b5517c0c', '175fed6e-6e2e-481d-91be-d549b827914b', '73badb5f-edfe-4af6-aa42-2cc6bff0eeed', 'Sticker', 'Matte black triangle stickers', '00000000-0000-4000-8000-000000000001', 'Alice', '2026-10-21 13:22:52.22818+00'),
('1cfd046e-cf6c-45b7-9c34-218262292588', '175fed6e-6e2e-481d-91be-d549b827914b', '0995f894-e7ab-4ef7-98a7-0963db2483c6', 'Socks', 'Octocat socks', '00000000-0000-4000-8000-000000000005', 'Elena', '2026-10-21 13:27:52.22818+00'),
('b8b2927f-5e2e-4a44-a8c6-5347988ac36a', '175fed6e-6e2e-481d-91be-d549b827914b', '0995f894-e7ab-4ef7-98a7-0963db2483c6', 'Notebook', 'Dot grid notebook', '00000000-0000-4000-8000-000000000006', 'Farid', '2026-10-21 13:32:52.22818+00'),
('1b16a186-cb24-4f00-8d04-1ff9da3fb92c', '175fed6e-6e2e-481d-91be-d549b827914b', '0995f894-e7ab-4ef7-98a7-0963db2483c6', 'Tote bag', 'Canvas tote', '00000000-0000-4000-8000-000000000007', NULL, '2026-10-21 13:37:52.22818+00'),
('abff97d8-6a04-49de-8960-fe845e65ec94', '175fed6e-6e2e-481d-91be-d549b827914b', 'd4097113-2e2a-41bf-92f1-3b42d032140a', 'Bottle', 'Orange steel bottle', '00000000-0000-4000-8000-000000000002', 'Bob', '2026-10-21 13:47:52.22818+00'),
('6e98ba5b-6cf7-4c18-9543-1dfa5f591a4e', '175fed6e-6e2e-481d-91be-d549b827914b', 'd4097113-2e2a-41bf-92f1-3b42d032140a', 'Pen', 'Standard ballpoint', '00000000-0000-4000-8000-000000000008', 'Hanna', '2026-10-21 13:52:52.22818+00'),
('e24ff2e1-3996-467c-a304-ace6a693c4d4', '175fed6e-6e2e-481d-91be-d549b827914b', '1d528799-2ff0-4b48-8862-7d3ff38f8877', 'T-shirt', 'Purple tee with Bits the dog', '00000000-0000-4000-8000-000000000003', 'Carla', '2026-10-21 14:02:52.22818+00'),
('0946bf9a-50a3-45e0-8715-3601bfcd1b4d', '175fed6e-6e2e-481d-91be-d549b827914b', '1d528799-2ff0-4b48-8862-7d3ff38f8877', 'Gadget', 'Phone stand', '00000000-0000-4000-8000-000000000004', 'Dmitri', '2026-10-21 14:07:52.22818+00'),
('c6392f87-79d6-41b8-b8ed-83a34cb368fc', '175fed6e-6e2e-481d-91be-d549b827914b', '1d528799-2ff0-4b48-8862-7d3ff38f8877', 'Snack', 'Gummy bears', '00000000-0000-4000-8000-000000000005', 'Elena', '2026-10-21 14:12:52.22818+00'),
('8ff69809-0612-4b27-b41f-0823e63d4d1f', '175fed6e-6e2e-481d-91be-d549b827914b', 'e093d0cb-759c-418a-91ee-2c091b3611bf', 'Hoodie', 'Grey hoodie, embroidered logo', '00000000-0000-4000-8000-000000000006', 'Farid', '2026-10-21 14:27:52.22818+00'),
('2f10491e-fcf1-44f3-b5eb-0e443ea5cd63', '175fed6e-6e2e-481d-91be-d549b827914b', 'e093d0cb-759c-418a-91ee-2c091b3611bf', 'Sticker', 'Die-cut sticker sheet', '00000000-0000-4000-8000-000000000007', NULL, '2026-10-21 14:37:52.22818+00'),
('5e13cb74-7ef2-4423-9537-af2de9c5a16b', '175fed6e-6e2e-481d-91be-d549b827914b', 'e093d0cb-759c-418a-91ee-2c091b3611bf', 'Other', 'Mechanical keyboard keycap', '00000000-0000-4000-8000-000000000008', 'Hanna', '2026-10-21 14:47:52.22818+00')
on conflict (id) do nothing;

insert into public.votes (id, swag_item_id, attendee_id, rating, created_at) values
('1f70292a-d95b-45a5-ac54-7595684e0d8f', '0cdd10b3-ed66-4519-bab1-aa1348c6b8b5', '00000000-0000-4000-8000-000000000002', 5, '2026-10-21 13:04:52.22818+00'),
('6a7c8b4c-4d45-4888-954d-a426ae24c21a', '02e892bd-84cd-42fb-8d74-37a1b3ec5abd', '00000000-0000-4000-8000-000000000001', 3, '2026-10-21 13:07:52.22818+00'),
('fd753288-f13b-4fc4-828e-428af3479270', '0cdd10b3-ed66-4519-bab1-aa1348c6b8b5', '00000000-0000-4000-8000-000000000003', 5, '2026-10-21 13:07:52.22818+00'),
('1955bbd4-5939-4394-b814-0e1b43a9d28a', '0cdd10b3-ed66-4519-bab1-aa1348c6b8b5', '00000000-0000-4000-8000-000000000004', 4, '2026-10-21 13:10:52.22818+00'),
('0f2e7b5c-a0b6-4204-9757-cee8bacaf2fc', '8a51b5c8-36c1-4e94-857a-51ae513ce183', '00000000-0000-4000-8000-000000000001', 5, '2026-10-21 13:13:52.22818+00'),
('8f856c46-f05f-452c-8118-34f679fb05e5', '0cdd10b3-ed66-4519-bab1-aa1348c6b8b5', '00000000-0000-4000-8000-000000000005', 5, '2026-10-21 13:13:52.22818+00'),
('93532d12-4f8e-43e2-98a9-4e0c467e53a3', '02e892bd-84cd-42fb-8d74-37a1b3ec5abd', '00000000-0000-4000-8000-000000000003', 4, '2026-10-21 13:13:52.22818+00'),
('7052bfd5-cb1f-4de5-952e-25c56f2721b1', '8a51b5c8-36c1-4e94-857a-51ae513ce183', '00000000-0000-4000-8000-000000000002', 5, '2026-10-21 13:16:52.22818+00'),
('e1147416-dbde-45f5-bd6f-478a01c6e268', '0cdd10b3-ed66-4519-bab1-aa1348c6b8b5', '00000000-0000-4000-8000-000000000006', 4, '2026-10-21 13:16:52.22818+00'),
('83762603-19de-4c4a-b6a1-5afadcb11d65', '9e5068ab-61f4-4102-9013-b114ef3259a5', '00000000-0000-4000-8000-000000000001', 4, '2026-10-21 13:19:52.22818+00'),
('f8fc46b5-da94-4123-ad70-5c7d075c50be', '9e5068ab-61f4-4102-9013-b114ef3259a5', '00000000-0000-4000-8000-000000000002', 3, '2026-10-21 13:22:52.22818+00'),
('82257240-938e-417a-9846-adfbcdcc802b', '0cdd10b3-ed66-4519-bab1-aa1348c6b8b5', '00000000-0000-4000-8000-000000000008', 5, '2026-10-21 13:22:52.22818+00'),
('10a146a0-f139-45ad-939f-19da0557fe79', '8a51b5c8-36c1-4e94-857a-51ae513ce183', '00000000-0000-4000-8000-000000000004', 5, '2026-10-21 13:22:52.22818+00'),
('4ee2ace0-2f09-4fd1-bade-162c954f269e', '8a51b5c8-36c1-4e94-857a-51ae513ce183', '00000000-0000-4000-8000-000000000005', 5, '2026-10-21 13:25:52.22818+00'),
('4eefd4e3-e0aa-4db2-8398-045274505bd5', '02e892bd-84cd-42fb-8d74-37a1b3ec5abd', '00000000-0000-4000-8000-000000000007', 3, '2026-10-21 13:25:52.22818+00'),
('f15397c4-c2bc-4284-a0e2-0ff980b1b325', '8a51b5c8-36c1-4e94-857a-51ae513ce183', '00000000-0000-4000-8000-000000000006', 5, '2026-10-21 13:28:52.22818+00'),
('4be29915-5426-4443-869a-60de545a434d', '8a51b5c8-36c1-4e94-857a-51ae513ce183', '00000000-0000-4000-8000-000000000007', 4, '2026-10-21 13:31:52.22818+00'),
('10f9868e-92a0-42af-abc3-19331514882b', '9e5068ab-61f4-4102-9013-b114ef3259a5', '00000000-0000-4000-8000-000000000005', 4, '2026-10-21 13:31:52.22818+00'),
('27dbbe55-722c-4366-a9a4-549bfc94e537', '8a51b5c8-36c1-4e94-857a-51ae513ce183', '00000000-0000-4000-8000-000000000008', 5, '2026-10-21 13:34:52.22818+00'),
('f1d2dc29-c05f-44e9-b444-dcfdaf771ce3', '9e5068ab-61f4-4102-9013-b114ef3259a5', '00000000-0000-4000-8000-000000000006', 4, '2026-10-21 13:34:52.22818+00'),
('d52b8d29-c314-4892-b6ae-37caaaf8204c', '1cfd046e-cf6c-45b7-9c34-218262292588', '00000000-0000-4000-8000-000000000001', 5, '2026-10-21 13:36:52.22818+00'),
('2e64fbe6-d23e-4a81-9b9a-1c8af7a85b0c', 'a56555ff-ec38-42eb-a558-29e0b5517c0c', '00000000-0000-4000-8000-000000000003', 2, '2026-10-21 13:36:52.22818+00'),
('030a373e-7a54-41fa-9f02-150d5153d1ac', 'a56555ff-ec38-42eb-a558-29e0b5517c0c', '00000000-0000-4000-8000-000000000004', 3, '2026-10-21 13:39:52.22818+00'),
('5f25d120-bf6b-4d69-bad3-ed01d6e669e7', '1cfd046e-cf6c-45b7-9c34-218262292588', '00000000-0000-4000-8000-000000000002', 4, '2026-10-21 13:39:52.22818+00'),
('d9ed9b5f-87df-4ff7-b308-e7d66ebf5a38', 'b8b2927f-5e2e-4a44-a8c6-5347988ac36a', '00000000-0000-4000-8000-000000000001', 3, '2026-10-21 13:42:52.22818+00'),
('122e792a-3c8a-4f44-920d-ec0084ea9f29', '1cfd046e-cf6c-45b7-9c34-218262292588', '00000000-0000-4000-8000-000000000003', 5, '2026-10-21 13:42:52.22818+00'),
('a24f0746-9d14-44c9-a3ea-cb7b01d06cf8', '1cfd046e-cf6c-45b7-9c34-218262292588', '00000000-0000-4000-8000-000000000004', 4, '2026-10-21 13:45:52.22818+00'),
('c7ccf5f5-5085-4e80-ac31-6828253be1f1', '1b16a186-cb24-4f00-8d04-1ff9da3fb92c', '00000000-0000-4000-8000-000000000002', 2, '2026-10-21 13:51:52.22818+00'),
('33996c94-9df4-42d1-b32c-bd28f9abcbdc', '1cfd046e-cf6c-45b7-9c34-218262292588', '00000000-0000-4000-8000-000000000007', 5, '2026-10-21 13:54:52.22818+00'),
('50ee7a1b-2eaf-465b-a192-3032975412e4', 'abff97d8-6a04-49de-8960-fe845e65ec94', '00000000-0000-4000-8000-000000000001', 4, '2026-10-21 13:59:52.22818+00'),
('489342d4-ac44-4a2d-b04c-659afa19d997', '1b16a186-cb24-4f00-8d04-1ff9da3fb92c', '00000000-0000-4000-8000-000000000005', 3, '2026-10-21 14:00:52.22818+00'),
('49da0140-b048-4b0f-9ba1-273bbaa30fb0', '1b16a186-cb24-4f00-8d04-1ff9da3fb92c', '00000000-0000-4000-8000-000000000006', 2, '2026-10-21 14:03:52.22818+00'),
('4792b2b7-fc29-48d2-9f80-be53777a540b', 'b8b2927f-5e2e-4a44-a8c6-5347988ac36a', '00000000-0000-4000-8000-000000000008', 3, '2026-10-21 14:03:52.22818+00'),
('b3b4d4b9-76b1-414b-9584-5337a92ec8eb', '6e98ba5b-6cf7-4c18-9543-1dfa5f591a4e', '00000000-0000-4000-8000-000000000001', 1, '2026-10-21 14:05:52.22818+00'),
('a893eb32-7327-41e2-bd52-41facae88159', 'abff97d8-6a04-49de-8960-fe845e65ec94', '00000000-0000-4000-8000-000000000003', 5, '2026-10-21 14:05:52.22818+00'),
('d427f14a-f0d6-47f8-91b1-0b017fbb10a8', 'abff97d8-6a04-49de-8960-fe845e65ec94', '00000000-0000-4000-8000-000000000004', 4, '2026-10-21 14:08:52.22818+00'),
('7604ef40-ce7b-4685-8549-727934d8bcf6', '6e98ba5b-6cf7-4c18-9543-1dfa5f591a4e', '00000000-0000-4000-8000-000000000002', 2, '2026-10-21 14:08:52.22818+00'),
('37d87e67-ab6c-49b4-8006-ae4b76fcfade', '6e98ba5b-6cf7-4c18-9543-1dfa5f591a4e', '00000000-0000-4000-8000-000000000003', 1, '2026-10-21 14:11:52.22818+00'),
('eaf2d782-410b-40b2-a60c-5c80ae5fa9a2', 'e24ff2e1-3996-467c-a304-ace6a693c4d4', '00000000-0000-4000-8000-000000000001', 4, '2026-10-21 14:16:52.22818+00'),
('aea80f8c-6104-48e7-bdcd-787ded9afbed', 'e24ff2e1-3996-467c-a304-ace6a693c4d4', '00000000-0000-4000-8000-000000000002', 5, '2026-10-21 14:19:52.22818+00'),
('92f494a0-1bfd-4bba-8005-72a26d74c397', '6e98ba5b-6cf7-4c18-9543-1dfa5f591a4e', '00000000-0000-4000-8000-000000000006', 2, '2026-10-21 14:20:52.22818+00'),
('ee6aa8a1-1683-459f-9512-e5ee59ad9f4a', 'abff97d8-6a04-49de-8960-fe845e65ec94', '00000000-0000-4000-8000-000000000008', 4, '2026-10-21 14:20:52.22818+00'),
('1a493fa8-c0ef-4435-b815-787677a9c014', '0946bf9a-50a3-45e0-8715-3601bfcd1b4d', '00000000-0000-4000-8000-000000000001', 3, '2026-10-21 14:22:52.22818+00'),
('1bfccb76-941b-43de-b1fa-46142386a6af', 'e24ff2e1-3996-467c-a304-ace6a693c4d4', '00000000-0000-4000-8000-000000000005', 4, '2026-10-21 14:28:52.22818+00'),
('730e591e-07a8-42bb-876b-48cd464bbe9a', 'c6392f87-79d6-41b8-b8ed-83a34cb368fc', '00000000-0000-4000-8000-000000000002', 4, '2026-10-21 14:31:52.22818+00'),
('bd55dc48-cced-4101-b261-a9c9a945797e', 'c6392f87-79d6-41b8-b8ed-83a34cb368fc', '00000000-0000-4000-8000-000000000003', 3, '2026-10-21 14:34:52.22818+00'),
('d394e5cc-9e8f-4e56-b452-347a8daf0d06', 'e24ff2e1-3996-467c-a304-ace6a693c4d4', '00000000-0000-4000-8000-000000000007', 5, '2026-10-21 14:34:52.22818+00'),
('ccc5d254-6196-498f-9280-91cb3c3d6b1a', '0946bf9a-50a3-45e0-8715-3601bfcd1b4d', '00000000-0000-4000-8000-000000000006', 4, '2026-10-21 14:37:52.22818+00'),
('afbe97a4-dbbf-4239-b6b6-f45f4d819ce9', 'e24ff2e1-3996-467c-a304-ace6a693c4d4', '00000000-0000-4000-8000-000000000008', 4, '2026-10-21 14:37:52.22818+00'),
('16c066bb-df2b-46b2-91ee-2ebc98d171ab', '8ff69809-0612-4b27-b41f-0823e63d4d1f', '00000000-0000-4000-8000-000000000001', 5, '2026-10-21 14:44:52.22818+00'),
('19791882-bd73-446f-8e9c-5ff43fa566a5', 'c6392f87-79d6-41b8-b8ed-83a34cb368fc', '00000000-0000-4000-8000-000000000007', 4, '2026-10-21 14:46:52.22818+00'),
('62476eec-86c0-4e3c-9934-2c5b2d553bda', '8ff69809-0612-4b27-b41f-0823e63d4d1f', '00000000-0000-4000-8000-000000000002', 4, '2026-10-21 14:47:52.22818+00'),
('2e88c440-1af8-40a5-8873-d834fd8ae8b9', 'c6392f87-79d6-41b8-b8ed-83a34cb368fc', '00000000-0000-4000-8000-000000000008', 5, '2026-10-21 14:49:52.22818+00'),
('8d148734-0a16-47dd-9fff-cd854570465c', '8ff69809-0612-4b27-b41f-0823e63d4d1f', '00000000-0000-4000-8000-000000000003', 5, '2026-10-21 14:50:52.22818+00'),
('a48856ef-32e4-4810-8de0-f578494743f1', '8ff69809-0612-4b27-b41f-0823e63d4d1f', '00000000-0000-4000-8000-000000000004', 5, '2026-10-21 14:53:52.22818+00'),
('ad0444c2-36f6-4df1-a0f2-06cbea0daa41', '8ff69809-0612-4b27-b41f-0823e63d4d1f', '00000000-0000-4000-8000-000000000005', 4, '2026-10-21 14:56:52.22818+00'),
('d735cf11-6fac-431b-8250-aecbe09c44bf', '8ff69809-0612-4b27-b41f-0823e63d4d1f', '00000000-0000-4000-8000-000000000007', 5, '2026-10-21 15:02:52.22818+00'),
('81f7b0cb-c3c6-4e68-a5f0-6f630cd80a07', '2f10491e-fcf1-44f3-b5eb-0e443ea5cd63', '00000000-0000-4000-8000-000000000004', 3, '2026-10-21 15:04:52.22818+00'),
('28a279f3-96f2-4723-af01-c56345d3509b', '5e13cb74-7ef2-4423-9537-af2de9c5a16b', '00000000-0000-4000-8000-000000000001', 5, '2026-10-21 15:06:52.22818+00'),
('e9673c26-1b90-4a24-9cee-1a608181e0ba', '5e13cb74-7ef2-4423-9537-af2de9c5a16b', '00000000-0000-4000-8000-000000000002', 5, '2026-10-21 15:09:52.22818+00'),
('fd4c7435-990c-416f-9f0a-63814fa9b340', '2f10491e-fcf1-44f3-b5eb-0e443ea5cd63', '00000000-0000-4000-8000-000000000006', 3, '2026-10-21 15:10:52.22818+00'),
('008db182-641a-4475-b38e-7f9c6b4a71f1', '5e13cb74-7ef2-4423-9537-af2de9c5a16b', '00000000-0000-4000-8000-000000000003', 4, '2026-10-21 15:12:52.22818+00'),
('fcf4441a-881c-4014-b080-342ad3b05b35', '5e13cb74-7ef2-4423-9537-af2de9c5a16b', '00000000-0000-4000-8000-000000000005', 5, '2026-10-21 15:18:52.22818+00')
on conflict (id) do nothing;

commit;

-- Expected after running: events 1, vendors 6, swag_items 16, votes 63.
-- select (select count(*) from events), (select count(*) from vendors), (select count(*) from swag_items), (select count(*) from votes);
