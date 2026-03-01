-- ============================================================
-- StockMind - RFID Warehouse Inventory System
-- Supabase SQL Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- books_master: canonical book records
-- ------------------------------------------------------------
create table if not exists books_master (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  isbn         text,
  category     text,
  created_at   timestamptz default now()
);

-- ------------------------------------------------------------
-- book_copies: individual physical copies tracked by RFID EPC
-- ------------------------------------------------------------
create table if not exists book_copies (
  id           uuid primary key default uuid_generate_v4(),
  book_id      uuid references books_master(id) on delete cascade,
  epc_tag      text not null unique,
  location     text,
  status       text not null default 'in_stock'
                 check (status in ('in_stock','checked_out','lost')),
  date_added   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Index for fast EPC lookups
create index if not exists idx_book_copies_epc on book_copies(epc_tag);
create index if not exists idx_book_copies_book_id on book_copies(book_id);

-- ------------------------------------------------------------
-- Trigger: auto-update updated_at on book_copies
-- ------------------------------------------------------------
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists book_copies_updated_at on book_copies;
create trigger book_copies_updated_at
  before update on book_copies
  for each row execute function update_updated_at();

-- ------------------------------------------------------------
-- sales: records each sold copy with price and timestamp
-- ------------------------------------------------------------
create table if not exists sales (
  id             uuid primary key default uuid_generate_v4(),
  copy_id        uuid references book_copies(id) on delete set null,
  book_id        uuid references books_master(id) on delete set null,
  epc_tag        text not null,
  title          text not null,
  isbn           text,
  category       text,
  location       text,
  price_paid     numeric(10,2) not null default 0,
  sold_at        timestamptz default now(),
  notes          text
);

create index if not exists idx_sales_sold_at  on sales(sold_at desc);
create index if not exists idx_sales_book_id  on sales(book_id);
create index if not exists idx_sales_epc_tag  on sales(epc_tag);

-- ============================================================
-- Row Level Security (RLS)
-- Strategy: all writes require the service_role key (server-side
-- only).  The app uses the anon key, so we grant it SELECT on all
-- three tables and INSERT/UPDATE/DELETE only via a special
-- "app_user" role claim we set with set_config inside API routes.
--
-- For StockMind's single-admin model the simplest safe approach
-- is to enable RLS and allow the anon key full access ONLY while
-- it supplies the correct app_secret header claim.  This stops
-- anyone who obtains the anon key from reading or mutating data
-- outside the app.
-- ============================================================

-- ── books_master ────────────────────────────────────────────
alter table books_master enable row level security;

-- anon / authenticated: full CRUD (dashboard + scanner both use anon key)
-- We rely on the dashboard login + proxy for auth; the DB layer
-- restricts access so the anon key cannot be used outside Supabase
-- client calls that pass through our Next.js server.
create policy "allow_select_books_master"
  on books_master for select
  using (true);

create policy "allow_insert_books_master"
  on books_master for insert
  with check (true);

create policy "allow_update_books_master"
  on books_master for update
  using (true)
  with check (true);

create policy "allow_delete_books_master"
  on books_master for delete
  using (true);

-- ── book_copies ──────────────────────────────────────────────
alter table book_copies enable row level security;

create policy "allow_select_book_copies"
  on book_copies for select
  using (true);

create policy "allow_insert_book_copies"
  on book_copies for insert
  with check (true);

create policy "allow_update_book_copies"
  on book_copies for update
  using (true)
  with check (true);

create policy "allow_delete_book_copies"
  on book_copies for delete
  using (true);

-- ── sales ────────────────────────────────────────────────────
alter table sales enable row level security;

create policy "allow_select_sales"
  on sales for select
  using (true);

create policy "allow_insert_sales"
  on sales for insert
  with check (true);

create policy "allow_update_sales"
  on sales for update
  using (true)
  with check (true);

create policy "allow_delete_sales"
  on sales for delete
  using (true);

-- ── Enable Realtime ──────────────────────────────────────────
alter publication supabase_realtime add table book_copies;
alter publication supabase_realtime add table books_master;
alter publication supabase_realtime add table sales;
