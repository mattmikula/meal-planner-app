-- Fix invite acceptance to always switch user to invited household
-- Previously, the WHERE clause prevented switching if current_household_id was already set
-- This caused users accepting invites to remain in their auto-created household

-- Drop and recreate the function with the fix
create or replace function accept_invite_atomic(
  p_invite_id uuid,
  p_household_id uuid,
  p_user_id uuid
)
returns table (
  member_id uuid,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_member_id uuid;
  existing_member_id uuid;
  existing_member_status text;
  invite_already_accepted boolean;
begin
  -- Lock invite row to prevent concurrent acceptance
  select accepted_at is not null into invite_already_accepted
  from household_invites
  where id = p_invite_id
  for update;

  -- Defense-in-depth: handle case where invite was deleted between API validation and RPC call
  if invite_already_accepted is null then
    return query select null::uuid, 'invite_not_found'::text;
    return;
  end if;

  if invite_already_accepted then
    return query select null::uuid, 'already_accepted'::text;
    return;
  end if;

  -- Check existing membership (with lock to prevent race conditions)
  select id, status into existing_member_id, existing_member_status
  from household_members
  where household_id = p_household_id
    and user_id = p_user_id
  for update;

  if found and existing_member_status = 'active' then
    return query select null::uuid, 'already_member'::text;
    return;
  end if;

  if found then
    -- Reactivate inactive member
    update household_members
    set status = 'active', updated_at = now()
    where id = existing_member_id
    returning id into new_member_id;
  else
    -- Insert new member
    begin
      insert into household_members (household_id, user_id, role, status)
      values (p_household_id, p_user_id, 'member', 'active')
      returning id into new_member_id;
    exception when unique_violation then
      -- Race condition: another request inserted membership
      return query select null::uuid, 'already_member'::text;
      return;
    end;
  end if;

  -- Mark invite as accepted
  update household_invites
  set accepted_at = now(), accepted_by = p_user_id
  where id = p_invite_id;

  -- FIXED: Always update user's current household to the invited household
  -- This ensures users switch to the household they were invited to
  insert into user_household_settings (user_id, current_household_id)
  values (p_user_id, p_household_id)
  on conflict (user_id) do update
    set current_household_id = excluded.current_household_id,
        updated_at = now();

  return query select new_member_id, null::text;
end;
$$;

-- Backfill migration: Fix users who are stuck in wrong household
-- Find users whose current_household_id doesn't match any active membership
-- and set it to their first active household
update user_household_settings
set current_household_id = subquery.household_id,
    updated_at = now()
from (
  select distinct on (hm.user_id)
    hm.user_id,
    hm.household_id
  from household_members hm
  where hm.status = 'active'
    and not exists (
      select 1
      from household_members hm2
      where hm2.user_id = hm.user_id
        and hm2.household_id = (
          select current_household_id
          from user_household_settings
          where user_id = hm.user_id
        )
        and hm2.status = 'active'
    )
  order by hm.user_id, hm.created_at asc
) as subquery
where user_household_settings.user_id = subquery.user_id;
