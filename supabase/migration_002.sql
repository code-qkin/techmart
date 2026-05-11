-- ============================================================
-- TechMart Migration 002
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Add email and phone to profiles
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists phone text not null default '';

-- 2. Update CEO profile with email (replace with actual CEO email)
-- update public.profiles set email = 'your-ceo-email@example.com'
-- where id = '0941adad-4159-48ed-ada3-50ce3bece47a';

-- 3. Update trigger to capture email on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'New User'),
    coalesce(new.raw_user_meta_data->>'role', 'secretary'),
    coalesce(new.email, '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- 4. Customers table
create table if not exists public.customers (
  id              text primary key default 'cust-' || gen_random_uuid()::text,
  name            text    not null,
  phone           text    not null,
  email           text,
  total_orders    integer not null default 0,
  total_spent     numeric not null default 0,
  last_order_date timestamptz,
  notes           text,
  created_at      timestamptz not null default now()
);
alter table public.customers enable row level security;
create policy "auth_all" on public.customers for all to authenticated using (true) with check (true);

-- 5. Suppliers table
create table if not exists public.suppliers (
  id             text primary key default 'sup-' || gen_random_uuid()::text,
  name           text    not null,
  contact_person text    not null default '',
  phone          text    not null default '',
  email          text,
  address        text,
  categories     jsonb   not null default '[]'::jsonb,
  notes          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
alter table public.suppliers enable row level security;
create policy "auth_all" on public.suppliers for all to authenticated using (true) with check (true);
