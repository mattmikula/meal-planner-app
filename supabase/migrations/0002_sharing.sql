-- Sharing support: households, invites, audit trail, and household scoping

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table if not exists user_household_settings (
  user_id uuid primary key,
  current_household_id uuid references households(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  email text not null,
  token_hash text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid
);

create unique index if not exists household_invites_token_hash_idx on household_invites(token_hash);
create index if not exists household_invites_household_idx on household_invites(household_id);
create index if not exists household_invites_email_idx on household_invites(email);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_user_id uuid,
  summary jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_household_idx on audit_log(household_id);
create index if not exists audit_log_entity_idx on audit_log(entity_type, entity_id);

-- Enable Row-Level Security on all new tables
alter table households enable row level security;
alter table household_members enable row level security;
alter table user_household_settings enable row level security;
alter table household_invites enable row level security;
alter table audit_log enable row level security;

-- RLS Policies: Users can only access data for households they belong to

-- Households: users can read their own households
create policy "Users can view their households"
  on households for select
  using (
    exists (
      select 1 from household_members
      where household_members.household_id = households.id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  );

-- Households: users can create new households
create policy "Users can create households"
  on households for insert
  with check (created_by = auth.uid());

-- Household members: users can view members of their households
create policy "Users can view household members"
  on household_members for select
  using (
    exists (
      select 1 from household_members as hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid()
        and hm.status = 'active'
    )
  );

-- Household members: allow management through service role only (via RPC functions)
-- NOTE: While this policy allows service_role full privileges, member changes are already
-- tracked via household_invites.accepted_by/accepted_at. The audit_log table is reserved
-- for tracking user-initiated operations (recipes, meals, plans, etc.) rather than
-- system-managed invite acceptance.
create policy "System can manage household members"
  on household_members for all
  to service_role
  using (true)
  with check (true);

-- User household settings: users can only access their own settings
create policy "Users can manage their own settings"
  on user_household_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Household invites: members can view invites for their households
create policy "Household members can view invites"
  on household_invites for select
  using (
    exists (
      select 1 from household_members
      where household_members.household_id = household_invites.household_id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  );

-- Household invites: members can create invites for their households
create policy "Household members can create invites"
  on household_invites for insert
  with check (
    exists (
      select 1 from household_members
      where household_members.household_id = household_invites.household_id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  );

-- Household invites: allow updates through service role only (via RPC functions)
create policy "System can update invites"
  on household_invites for update
  to service_role
  using (true)
  with check (true);

-- Audit log: household members can view audit logs for their households
create policy "Household members can view audit logs"
  on audit_log for select
  using (
    exists (
      select 1 from household_members
      where household_members.household_id = audit_log.household_id
        and household_members.user_id = auth.uid()
        and household_members.status = 'active'
    )
  );

-- Audit log: system can insert audit events (service role only)
create policy "System can create audit logs"
  on audit_log for insert
  to service_role
  with check (true);

-- One-time migration: establish mapping between existing users and their newly created households.
-- This temporary table collects all users who have created meals or plans, then assigns each
-- user a new household ID for backfilling the households and household_members tables.
-- NOTE: This migration depends on 0001_init.sql having been applied (requires meals and plans tables).
-- NOTE: This migration is idempotent. If the household_id column already exists on meals,
-- the migration has already been run and the data migration will be skipped.
do $$
begin
  -- Only run data migration if we haven't migrated yet (check if user_id still exists on meals)
  if exists (
    select 1 from information_schema.columns
    where table_name = 'meals' and column_name = 'user_id'
  ) then
    -- Create a temporary mapping table to establish which household each user should belong to.
    -- This table maps each existing user (from meals/plans) to a newly generated household ID,
    -- allowing us to atomically migrate all user data to the household-based schema.
    create temporary table user_households (
      user_id uuid primary key,
      household_id uuid not null
    );

    -- Only attempt to populate user_households if meals or plans tables exist
    if exists (
      select 1 from information_schema.tables
      where table_name in ('meals', 'plans')
    ) then
      insert into user_households (user_id, household_id)
      select user_id, gen_random_uuid()
      from (
        select user_id from meals where exists (select 1 from information_schema.tables where table_name = 'meals')
        union
        select user_id from plans where exists (select 1 from information_schema.tables where table_name = 'plans')
      ) users;
    end if;

    -- Ensure all existing auth users get a household, even if they have no meals/plans yet.
    -- This prevents issues when users without existing data try to create content later.
    insert into user_households (user_id, household_id)
    select id, gen_random_uuid()
    from auth.users
    where id not in (select user_id from user_households)
    on conflict (user_id) do nothing;

    insert into households (id, created_by)
    select household_id, user_id
    from user_households;

    insert into household_members (household_id, user_id, role, status)
    select household_id, user_id, 'owner', 'active'
    from user_households
    on conflict (household_id, user_id) do nothing;

    insert into user_household_settings (user_id, current_household_id)
    select user_id, household_id
    from user_households
    on conflict (user_id) do nothing;

    -- Add new columns to meals table before updating
    alter table meals
      add column if not exists household_id uuid references households(id) on delete cascade,
      add column if not exists created_by uuid,
      add column if not exists updated_by uuid,
      add column if not exists updated_at timestamptz;

    -- Update meals with household_id and created_by from user_households mapping
    update meals
    set household_id = user_households.household_id,
        created_by = meals.user_id
    from user_households
    where meals.user_id = user_households.user_id
      and (meals.household_id is null or meals.created_by is null);

    -- Add new columns to plans table before updating
    alter table plans
      drop constraint if exists plans_user_id_week_start_key,
      add column if not exists household_id uuid references households(id) on delete cascade,
      add column if not exists created_by uuid,
      add column if not exists updated_by uuid,
      add column if not exists updated_at timestamptz;

    -- Update plans with household_id and created_by from user_households mapping
    update plans
    set household_id = user_households.household_id,
        created_by = plans.user_id
    from user_households
    where plans.user_id = user_households.user_id
      and (plans.household_id is null or plans.created_by is null);

    -- Populate plan_days with household_id and created_by from plans if needed
    if exists (
      select 1
      from plan_days
      join plans on plan_days.plan_id = plans.id
      where plan_days.household_id is null
         or plan_days.created_by is null
    ) then
      update plan_days
      set household_id = plans.household_id,
          created_by = plans.created_by
      from plans
      where plan_days.plan_id = plans.id
        and (plan_days.household_id is null or plan_days.created_by is null);
    end if;

    drop table if exists user_households;
  end if;
end $$;

-- Ensure columns exist (idempotent for fresh databases or reruns)
alter table meals
  add column if not exists household_id uuid references households(id) on delete cascade,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz;

-- Finalize meals schema
alter table meals
  alter column household_id set not null,
  alter column created_by set not null,
  drop column if exists user_id;

-- Ensure columns exist (idempotent for fresh databases or reruns)
alter table plans
  drop constraint if exists plans_user_id_week_start_key,
  add column if not exists household_id uuid references households(id) on delete cascade,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz;

-- Finalize plans schema

alter table plans
  alter column household_id set not null,
  alter column created_by set not null,
  drop column if exists user_id,
  add constraint plans_household_week_start_key unique (household_id, week_start);

alter table plan_days
  add column if not exists household_id uuid references households(id) on delete cascade,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz;

-- Note: plan_days update moved inside migration block above to avoid unnecessary execution on fresh databases

alter table plan_days
  alter column household_id set not null,
  alter column created_by set not null;

create or replace function accept_household_invite(
  p_token_hash text
)
returns table (
  household_id uuid,
  member_id uuid,
  error_message text,
  error_status integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record household_invites%rowtype;
  new_member_id uuid;
  existing_member_id uuid;
  existing_member_status text;
  v_user_id uuid;
  v_user_email text;
begin
  -- Get authenticated user from Supabase auth
  v_user_id := auth.uid();
  if v_user_id is null then
    return query select null::uuid, null::uuid, 'Authentication required.', 401;
    return;
  end if;

  -- Get user email from auth metadata
  v_user_email := lower((auth.jwt() -> 'email')::text);
  if v_user_email is null or v_user_email = '' then
    return query select null::uuid, null::uuid, 'User email is required.', 400;
    return;
  end if;

  -- Remove quotes from JSON string
  v_user_email := trim(both '"' from v_user_email);

  select * into invite_record
  from household_invites
  where token_hash = p_token_hash
  for update skip locked;

  if not found then
    return query select null::uuid, null::uuid, 'Invalid or expired invite.', 400;
    return;
  end if;

  if invite_record.accepted_at is not null then
    return query select null::uuid, null::uuid, 'Invite already used.', 409;
    return;
  end if;

  if invite_record.expires_at <= now() then
    return query select null::uuid, null::uuid, 'Invite expired.', 400;
    return;
  end if;

  -- Email comparison: both stored and user emails are lowercase
  if lower(invite_record.email) <> v_user_email then
    return query select null::uuid, null::uuid, 'This invite was sent to a different email address than the one you''re signed in with.', 403;
    return;
  end if;

  select id, status into existing_member_id, existing_member_status
  from household_members
  where household_id = invite_record.household_id
    and user_id = v_user_id
  limit 1;

  if found then
    if existing_member_status = 'active' then
      return query select null::uuid, null::uuid, 'User already belongs to this household.', 409;
      return;
    end if;

    begin
      update household_members
      set status = 'active',
          updated_at = now()
      where id = existing_member_id
      returning id into new_member_id;

      -- Handle race condition: if update somehow failed and row was deleted/changed
      if not found then
        insert into household_members (household_id, user_id, role, status)
        values (invite_record.household_id, v_user_id, 'member', 'active')
        returning id into new_member_id;
      end if;
    exception
      when unique_violation then
        return query select null::uuid, null::uuid, 'User already belongs to this household.', 409;
        return;
    end;
  else
    begin
      insert into household_members (household_id, user_id, role, status)
      values (invite_record.household_id, v_user_id, 'member', 'active')
      returning id into new_member_id;
    exception
      when unique_violation then
        return query select null::uuid, null::uuid, 'User already belongs to this household.', 409;
        return;
    end;
  end if;

  update household_invites
  set accepted_at = now(),
      accepted_by = v_user_id
  where id = invite_record.id;

  -- Automatically switch user's current household to the newly joined one.
  -- WARNING: This unconditionally changes the user's context, which may disrupt
  -- their workflow if they were actively using a different household.
  -- Future enhancement: Make this optional or prompt the user to switch.
  insert into user_household_settings (user_id, current_household_id)
  values (v_user_id, invite_record.household_id)
  on conflict (user_id) do update
    set current_household_id = excluded.current_household_id,
        updated_at = now();

  return query select invite_record.household_id, new_member_id, null::text, null::int;
end;
$$;

-- Function to atomically create a household and owner member in a transaction
create or replace function create_household_with_member(p_user_id uuid)
returns table(household_id uuid, member_id uuid) 
language plpgsql
security definer
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
