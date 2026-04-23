-- Bill Builder — unified schema (destructive reset)
-- Run once in Supabase SQL Editor. Wipes all existing data.

-- ============ RESET ============

drop function if exists list_members(uuid) cascade;
drop function if exists remove_member(uuid, uuid) cascade;
drop function if exists create_company(text) cascade;
drop function if exists join_company(text) cascade;
drop function if exists is_owner(uuid) cascade;
drop function if exists is_member(uuid) cascade;

drop table if exists invoices cascade;
drop table if exists products cascade;
drop table if exists buyers cascade;
drop table if exists sellers cascade;
drop table if exists memberships cascade;
drop table if exists companies cascade;
drop table if exists gstin_cache cascade;

-- ============ TABLES ============

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz default now()
);

create table memberships (
  user_id uuid not null references auth.users on delete cascade,
  company_id uuid not null references companies on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz default now(),
  primary key (user_id, company_id)
);

create index memberships_user_idx on memberships(user_id);
create index memberships_company_idx on memberships(company_id);

create table sellers (
  company_id uuid primary key references companies on delete cascade,
  gstin text,
  lgl_nm text,
  addr1 text,
  addr2 text,
  loc text,
  pin integer,
  stcd text,
  ph text,
  em text,
  updated_at timestamptz default now()
);

create table buyers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  gstin text not null,
  lgl_nm text not null,
  addr1 text not null,
  addr2 text,
  loc text not null,
  pin integer not null,
  pos text not null,
  stcd text not null,
  ph text,
  em text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index buyers_company_idx on buyers(company_id);

create table products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  prd_desc text not null,
  description text,
  hsn_cd text not null,
  unit text not null,
  default_price numeric not null,
  gst_rt numeric not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index products_company_idx on products(company_id);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  doc_no text not null,
  doc_dt text not null,
  buyer_id uuid references buyers on delete set null,
  bill_to jsonb not null default '{}',
  items jsonb not null default '[]',
  ship_to jsonb,
  ewb jsonb,
  force_total numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index invoices_company_idx on invoices(company_id);

-- GSTIN lookup cache (shared across companies — registry data is public).
-- Rows written by the `lookup-gstin` edge function via service role.
create table gstin_cache (
  gstin       text primary key,
  data        jsonb not null,
  fetched_at  timestamptz not null default now()
);

-- ============ HELPERS ============

create or replace function is_member(co uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from memberships where user_id = auth.uid() and company_id = co);
$$;

create or replace function is_owner(co uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from memberships where user_id = auth.uid() and company_id = co and role = 'owner');
$$;

-- ============ ROW LEVEL SECURITY ============

alter table companies     enable row level security;
alter table memberships   enable row level security;
alter table sellers       enable row level security;
alter table buyers        enable row level security;
alter table products      enable row level security;
alter table invoices      enable row level security;
alter table gstin_cache   enable row level security;

create policy "companies_read"      on companies    for select using (is_member(id));
create policy "companies_update"    on companies    for update using (is_owner(id));

create policy "memberships_read"    on memberships  for select using (user_id = auth.uid() or is_member(company_id));
create policy "memberships_leave"   on memberships  for delete using (user_id = auth.uid());

create policy "sellers_co"          on sellers      for all using (is_member(company_id)) with check (is_member(company_id));
create policy "buyers_co"           on buyers       for all using (is_member(company_id)) with check (is_member(company_id));
create policy "products_co"         on products     for all using (is_member(company_id)) with check (is_member(company_id));
create policy "invoices_co"         on invoices     for all using (is_member(company_id)) with check (is_member(company_id));

-- gstin_cache: any signed-in user can read; writes happen only via service role (edge function)
create policy "gstin_cache_read"    on gstin_cache  for select using (auth.uid() is not null);

-- ============ RPCs ============

create or replace function create_company(p_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_co uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into companies (name) values (p_name) returning id into new_co;
  insert into memberships (user_id, company_id, role) values (auth.uid(), new_co, 'owner');
  insert into sellers (company_id) values (new_co);
  return new_co;
end $$;

create or replace function join_company(p_code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare co_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into co_id from companies where invite_code = p_code;
  if co_id is null then raise exception 'Invalid invite code'; end if;
  insert into memberships (user_id, company_id, role)
    values (auth.uid(), co_id, 'member') on conflict do nothing;
  return co_id;
end $$;

create or replace function list_members(p_company_id uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.company_id = p_company_id
    and is_member(m.company_id)
  order by m.created_at;
$$;

create or replace function remove_member(p_company_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not is_owner(p_company_id) then
    raise exception 'Only owners can remove members';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot remove yourself; leave the company instead';
  end if;
  delete from memberships where company_id = p_company_id and user_id = p_user_id;
end $$;

grant execute on function create_company(text)       to authenticated;
grant execute on function join_company(text)         to authenticated;
grant execute on function list_members(uuid)         to authenticated;
grant execute on function remove_member(uuid, uuid)  to authenticated;
