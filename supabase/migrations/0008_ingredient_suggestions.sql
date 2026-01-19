-- Ingredient suggestions: normalized ingredients and meal ingredient mapping

create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz,
  updated_by uuid,
  unique (household_id, normalized_name)
);

create index if not exists ingredients_household_idx on ingredients(household_id);
create index if not exists ingredients_household_normalized_idx on ingredients(household_id, normalized_name);

create table if not exists meal_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  meal_id uuid not null references meals(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  unique (meal_id, ingredient_id)
);

create index if not exists meal_ingredients_household_idx on meal_ingredients(household_id);
create index if not exists meal_ingredients_meal_idx on meal_ingredients(meal_id);
create index if not exists meal_ingredients_ingredient_idx on meal_ingredients(ingredient_id);

alter table ingredients enable row level security;
alter table meal_ingredients enable row level security;

drop policy if exists "Household members can access ingredients" on ingredients;
create policy "Household members can access ingredients"
  on ingredients for all
  using (
    exists (
      select 1 from household_members
      where household_members.household_id = ingredients.household_id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from household_members
      where household_members.household_id = ingredients.household_id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  );

drop policy if exists "Household members can access meal ingredients" on meal_ingredients;
create policy "Household members can access meal ingredients"
  on meal_ingredients for all
  using (
    exists (
      select 1 from household_members
      where household_members.household_id = meal_ingredients.household_id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from household_members
      where household_members.household_id = meal_ingredients.household_id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  );
