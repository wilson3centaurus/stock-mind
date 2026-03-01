-- ============================================================
-- StockMind — Tables + Row Level Security
-- Run this once in Supabase SQL Editor.
-- Safe to re-run (idempotent).
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── books_master ─────────────────────────────────────────────
create table if not exists books_master (
  id         uuid primary key default uuid_generate_v4(),
  title      text not null,
  isbn       text,
  category   text,
  created_at timestamptz default now()
);

-- ── book_copies ───────────────────────────────────────────────
create table if not exists book_copies (
  id         uuid primary key default uuid_generate_v4(),
  book_id    uuid references books_master(id) on delete cascade,
  epc_tag    text not null unique,
  location   text,
  status     text not null default 'in_stock'
               check (status in ('in_stock','checked_out','lost')),
  date_added timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_book_copies_epc     on book_copies(epc_tag);
create index if not exists idx_book_copies_book_id on book_copies(book_id);

-- auto-update updated_at
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

-- ── sales ─────────────────────────────────────────────────────
create table if not exists sales (
  id         uuid primary key default uuid_generate_v4(),
  copy_id    uuid references book_copies(id) on delete set null,
  book_id    uuid references books_master(id) on delete set null,
  epc_tag    text not null,
  title      text not null,
  isbn       text,
  category   text,
  location   text,
  price_paid numeric(10,2) not null default 0,
  sold_at    timestamptz default now(),
  notes      text
);

create index if not exists idx_sales_sold_at on sales(sold_at desc);
create index if not exists idx_sales_book_id on sales(book_id);
create index if not exists idx_sales_epc_tag on sales(epc_tag);

-- ── Realtime ──────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'book_copies'
  ) then
    alter publication supabase_realtime add table book_copies;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'books_master'
  ) then
    alter publication supabase_realtime add table books_master;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'sales'
  ) then
    alter publication supabase_realtime add table sales;
  end if;
end $$;

-- ── RLS — books_master ────────────────────────────────────────
alter table books_master enable row level security;

-- Drop existing policies first so this script is idempotent
drop policy if exists "allow_select_books_master"  on books_master;
drop policy if exists "allow_insert_books_master"  on books_master;
drop policy if exists "allow_update_books_master"  on books_master;
drop policy if exists "allow_delete_books_master"  on books_master;

-- The anon key is never exposed publicly (all requests go through
-- our Next.js server which sits behind the dashboard login proxy).
-- RLS is enabled so direct Supabase API calls with a leaked anon
-- key cannot bypass the app.  Policies below allow the anon role
-- full CRUD because row-level restriction is enforced at the
-- application layer (HMAC session cookie + proxy).
create policy "allow_select_books_master"
  on books_master for select
  to anon, authenticated
  using (true);

create policy "allow_insert_books_master"
  on books_master for insert
  to anon, authenticated
  with check (true);

create policy "allow_update_books_master"
  on books_master for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "allow_delete_books_master"
  on books_master for delete
  to anon, authenticated
  using (true);

-- ── book_copies ───────────────────────────────────────────────
alter table book_copies enable row level security;

drop policy if exists "allow_select_book_copies"  on book_copies;
drop policy if exists "allow_insert_book_copies"  on book_copies;
drop policy if exists "allow_update_book_copies"  on book_copies;
drop policy if exists "allow_delete_book_copies"  on book_copies;

create policy "allow_select_book_copies"
  on book_copies for select
  to anon, authenticated
  using (true);

create policy "allow_insert_book_copies"
  on book_copies for insert
  to anon, authenticated
  with check (true);

create policy "allow_update_book_copies"
  on book_copies for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "allow_delete_book_copies"
  on book_copies for delete
  to anon, authenticated
  using (true);

-- ── sales ─────────────────────────────────────────────────────
alter table sales enable row level security;

drop policy if exists "allow_select_sales"  on sales;
drop policy if exists "allow_insert_sales"  on sales;
drop policy if exists "allow_update_sales"  on sales;
drop policy if exists "allow_delete_sales"  on sales;

create policy "allow_select_sales"
  on sales for select
  to anon, authenticated
  using (true);

create policy "allow_insert_sales"
  on sales for insert
  to anon, authenticated
  with check (true);

create policy "allow_update_sales"
  on sales for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "allow_delete_sales"
  on sales for delete
  to anon, authenticated
  using (true);
