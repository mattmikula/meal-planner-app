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
  unique (user_id)
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

create index if not exists household_invites_token_hash_idx on household_invites(token_hash);
create index if not exists household_invites_household_idx on household_invites(household_id);

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

alter table meals
  add column if not exists household_id uuid not null references households(id) on delete cascade,
  add column if not exists created_by uuid not null,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz,
  drop column if exists user_id;

alter table plans
  drop constraint if exists plans_user_id_week_start_key,
  add column if not exists household_id uuid not null references households(id) on delete cascade,
  add column if not exists created_by uuid not null,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz,
  drop column if exists user_id,
  add constraint plans_household_week_start_key unique (household_id, week_start);

alter table plan_days
  add column if not exists household_id uuid not null references households(id) on delete cascade,
  add column if not exists created_by uuid not null,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz;
