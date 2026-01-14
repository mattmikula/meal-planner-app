-- Enable RLS on core domain tables and add household-scoped policies.

alter table meals enable row level security;
alter table plans enable row level security;
alter table plan_days enable row level security;

drop policy if exists "Household members can access meals" on meals;
create policy "Household members can access meals"
  on meals for all
  using (
    exists (
      select 1 from household_members
      where household_members.household_id = meals.household_id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from household_members
      where household_members.household_id = meals.household_id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  );

drop policy if exists "Household members can access plans" on plans;
create policy "Household members can access plans"
  on plans for all
  using (
    exists (
      select 1 from household_members
      where household_members.household_id = plans.household_id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from household_members
      where household_members.household_id = plans.household_id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  );

drop policy if exists "Household members can access plan days" on plan_days;
create policy "Household members can access plan days"
  on plan_days for all
  using (
    exists (
      select 1 from household_members
      where household_members.household_id = plan_days.household_id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from household_members
      where household_members.household_id = plan_days.household_id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  );
