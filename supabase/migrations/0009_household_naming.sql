-- Household naming support

drop function if exists create_household_with_member(uuid);

create or replace function create_household_with_member(
  p_user_id uuid,
  p_name text default null
)
returns table(household_id uuid, member_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
  new_member_id uuid;
begin
  -- Create household
  insert into households (created_by, name)
  values (p_user_id, p_name)
  returning id into new_household_id;

  -- Create member
  insert into household_members (household_id, user_id, role, status)
  values (new_household_id, p_user_id, 'owner', 'active')
  returning id into new_member_id;

  return query select new_household_id, new_member_id;
end;
$$;

drop policy if exists "Household owners can update households" on households;

create policy "Household owners can update households"
  on households for update
  using (
    exists (
      select 1 from household_members
      where household_members.household_id = households.id
        and household_members.user_id = auth.uid()
        and household_members.role = 'owner'
        and household_members.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from household_members
      where household_members.household_id = households.id
        and household_members.user_id = auth.uid()
        and household_members.role = 'owner'
        and household_members.status = 'active'
    )
  );
