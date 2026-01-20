-- Ensure create_household_with_member is idempotent per user to avoid duplicate households.
-- Uses an advisory transaction lock keyed by user ID to serialize concurrent calls.

create or replace function create_household_with_member(p_user_id uuid)
returns table(household_id uuid, member_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_household_id uuid;
  existing_member_id uuid;
  new_household_id uuid;
  new_member_id uuid;
begin
  -- Serialize household creation per user to prevent duplicate households.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- If the user already has an active membership, return the earliest one.
  select hm.household_id, hm.id
  into existing_household_id, existing_member_id
  from household_members hm
  where hm.user_id = p_user_id
    and hm.status = 'active'
  order by hm.created_at asc
  limit 1
  for update;

  if found then
    return query select existing_household_id, existing_member_id;
    return;
  end if;

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
