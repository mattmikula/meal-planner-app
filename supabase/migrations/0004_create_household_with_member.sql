-- Function to atomically create a household and owner member in a transaction
create or replace function create_household_with_member(p_user_id uuid)
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
  insert into households (created_by)
  values (p_user_id)
  returning id into new_household_id;

  -- Create member
  insert into household_members (household_id, user_id, role, status)
  values (new_household_id, p_user_id, 'owner', 'active')
  returning id into new_member_id;

  return query select new_household_id, new_member_id;
end;
$$;
