-- Atomic plan generation updates for plan days and plan row.
-- Business logic (meal selection, locked-day handling) lives in the API layer.
-- This function only applies the resulting assignments in a single transaction.
create or replace function apply_plan_generation(
  p_plan_id uuid,
  p_household_id uuid,
  p_user_id uuid,
  p_generated_at timestamptz,
  p_assignments jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update plan_days as pd
  set meal_id = a.meal_id,
      updated_at = p_generated_at,
      updated_by = p_user_id
  from jsonb_to_recordset(p_assignments) as a(id uuid, meal_id uuid)
  where pd.id = a.id;

  update plans
  set updated_at = p_generated_at,
      updated_by = p_user_id
  where id = p_plan_id
    and household_id = p_household_id;
end;
$$;
