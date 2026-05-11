-- ============================================================
-- TechMart Supabase Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. PROFILES (linked to Supabase Auth users)
create table if not exists public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  name       text    not null,
  role       text    not null check (role in ('ceo', 'admin', 'secretary')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. PRODUCTS
create table if not exists public.products (
  id                  text primary key default gen_random_uuid()::text,
  name                text    not null,
  category            text    not null check (category in ('Phones','Laptops','Tablets','Accessories')),
  brand               text    not null,
  price               numeric not null default 0,
  stock               integer not null default 0,
  low_stock_threshold integer not null default 5,
  description         text,
  emoji               text    not null default '📦',
  variants            jsonb   not null default '[]'::jsonb,
  supplier            text,
  created_at          timestamptz not null default now()
);

-- 3. ORDERS
create table if not exists public.orders (
  id                    text primary key,
  staff_id              uuid references public.profiles(id),
  staff_name            text    not null,
  customer_name         text    not null,
  customer_phone        text    not null default '',
  items                 jsonb   not null default '[]'::jsonb,
  subtotal              numeric not null default 0,
  tax_amount            numeric not null default 0,
  discount_amount       numeric not null default 0,
  total_amount          numeric not null default 0,
  payment_method        text    not null check (payment_method in ('Cash','POS','Transfer','Layaway')),
  payment_status        text    not null check (payment_status in ('Paid','Unpaid','Partial')),
  transaction_reference text,
  status                text    not null check (status in ('Pending','Processing','Completed','Cancelled','Refunded')),
  installment           jsonb,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- 4. EXPENSES
create table if not exists public.expenses (
  id          text primary key default 'exp-' || gen_random_uuid()::text,
  category    text    not null check (category in ('Rent','Utilities','Salaries','Restocking','Marketing','Other')),
  description text    not null,
  amount      numeric not null,
  date        date    not null,
  recorded_by text    not null,
  created_at  timestamptz not null default now()
);

-- 5. AUDIT LOGS
create table if not exists public.audit_logs (
  id        text primary key default gen_random_uuid()::text,
  user_id   uuid references public.profiles(id),
  user_name text not null,
  user_role text not null,
  action    text not null,
  entity    text not null,
  entity_id text,
  details   text not null,
  timestamp timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles   enable row level security;
alter table public.products   enable row level security;
alter table public.orders     enable row level security;
alter table public.expenses   enable row level security;
alter table public.audit_logs enable row level security;

-- All authenticated users can read/write (tighten per role later)
create policy "auth_all" on public.profiles   for all to authenticated using (true) with check (true);
create policy "auth_all" on public.products   for all to authenticated using (true) with check (true);
create policy "auth_all" on public.orders     for all to authenticated using (true) with check (true);
create policy "auth_all" on public.expenses   for all to authenticated using (true) with check (true);
create policy "auth_all" on public.audit_logs for all to authenticated using (true) with check (true);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'New User'),
    coalesce(new.raw_user_meta_data->>'role', 'secretary')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- CEO SETUP
-- After running this schema, create the CEO account:
--   1. Go to Supabase Dashboard → Authentication → Users → Add user
--   2. Enter the CEO email + password, click "Create user"
--   3. Copy the UUID shown for that user
--   4. Run this SQL (replace the UUID and name):
--
-- update public.profiles
-- set name = 'Your Real Name', role = 'ceo'
-- where id = 'paste-ceo-uuid-here';
--
-- ============================================================
