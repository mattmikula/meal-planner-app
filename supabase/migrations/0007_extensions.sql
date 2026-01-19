-- Extensions: meal images, leftovers, and grocery list

alter table meals
  add column if not exists image_url text;

alter table plan_days
  add column if not exists leftover_from_plan_day_id uuid references plan_days(id) on delete set null;

create table if not exists grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  quantity text,
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz,
  updated_by uuid
);

create index if not exists grocery_items_household_idx on grocery_items(household_id);
create index if not exists grocery_items_checked_idx on grocery_items(household_id, checked);

alter table grocery_items enable row level security;

drop policy if exists "Household members can access grocery items" on grocery_items;
create policy "Household members can access grocery items"
  on grocery_items for all
  using (
    exists (
      select 1 from household_members
      where household_members.household_id = grocery_items.household_id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from household_members
      where household_members.household_id = grocery_items.household_id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  );
