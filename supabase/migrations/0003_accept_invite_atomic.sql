-- Minimal atomic function for invite acceptance.
-- Business logic (email validation, expiry checks) should be handled in the API route.
-- This function only handles the atomic database operations that must run in a transaction:
--   1. Lock the invite row to prevent concurrent acceptance
--   2. Create or reactivate household membership
--   3. Mark invite as accepted
--   4. Update user's current household setting
--
-- Returns error_code values:
--   'invite_not_found' - Invite does not exist (concurrent deletion or invalid ID)
--   'already_accepted' - Invite was already used
--   'already_member' - User is already an active member of this household
--   null - Success (member_id will be set)
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

  -- Update user's current household if not already set
  insert into user_household_settings (user_id, current_household_id)
  values (p_user_id, p_household_id)
  on conflict (user_id) do update
    set current_household_id = excluded.current_household_id,
        updated_at = now()
    where user_household_settings.current_household_id is null;

  return query select new_member_id, null::text;
end;
$$;
