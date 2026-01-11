-- Scaffold schema for Meal Planner

create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  week_start date not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table if not exists plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  date date not null,
  meal_id uuid references meals(id) on delete set null,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (plan_id, date)
);
