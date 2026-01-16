import "server-only";
import { z } from "zod";

import type { components } from "@/lib/api/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

export type PlanDay = components["schemas"]["PlanDay"];
export type Plan = components["schemas"]["Plan"];
export type PlanFetchQuery = {
  weekStart: components["schemas"]["PlanWeekStart"];
};
export type PlanGenerateRequest = components["schemas"]["PlanGenerateRequest"];

type PlanRow = {
  id: string;
  week_start: string;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
};

type PlanDayRow = {
  id: string;
  plan_id: string;
  date: string;
  meal_id: string | null;
  locked: boolean;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
};

type MealRow = {
  id: string;
  name: string;
};

const WEEK_START_REQUIRED_MESSAGE = "Week start is required.";
const WEEK_START_TYPE_MESSAGE = "Week start must be a string.";
const WEEK_START_FORMAT_MESSAGE = "Week start must be in YYYY-MM-DD format.";
const WEEK_START_INVALID_MESSAGE = "Week start must be a valid date.";
const WEEK_START_UNEXPECTED_MESSAGE = "Week start could not be parsed.";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDate = (value: string): Date | null => {
  if (!DATE_PATTERN.test(value)) {
    return null;
  }

  const [yearPart, monthPart, dayPart] = value.split("-");
  const year = Number.parseInt(yearPart ?? "", 10);
  const month = Number.parseInt(monthPart ?? "", 10);
  const day = Number.parseInt(dayPart ?? "", 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const formatDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const planWeekStartSchema = z
  .any()
  .superRefine((value, ctx) => {
    if (value === undefined || value === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: WEEK_START_REQUIRED_MESSAGE });
      return;
    }
    if (typeof value !== "string") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: WEEK_START_TYPE_MESSAGE });
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: WEEK_START_REQUIRED_MESSAGE });
      return;
    }
    if (!DATE_PATTERN.test(trimmed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: WEEK_START_FORMAT_MESSAGE });
      return;
    }
    if (!parseDate(trimmed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: WEEK_START_INVALID_MESSAGE });
    }
  })
  .transform((value) => (typeof value === "string" ? value.trim() : value)) as z.ZodType<
  components["schemas"]["PlanWeekStart"]
>;

export const planFetchQuerySchema = z.object({
  weekStart: planWeekStartSchema
}) satisfies z.ZodType<PlanFetchQuery>;

export const planGenerateRequestSchema = z.object({
  weekStart: planWeekStartSchema
}) satisfies z.ZodType<PlanGenerateRequest>;

export class PlanGenerationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PlanGenerationError";
    this.status = status;
  }
}

export const normalizeWeekStart = (weekStart: string): string => {
  const parsed = parseDate(weekStart);
  if (!parsed) {
    throw new Error(WEEK_START_UNEXPECTED_MESSAGE);
  }

  const dayOfWeek = parsed.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - daysSinceMonday);

  return formatDate(parsed);
};

const buildWeekDates = (weekStart: string): string[] => {
  const base = parseDate(weekStart);
  if (!base) {
    throw new Error(WEEK_START_UNEXPECTED_MESSAGE);
  }

  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const day = base.getUTCDate();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(year, month, day + index));
    return formatDate(date);
  });
};

export type PlanDayAssignment = {
  id: string;
  mealId: string;
};

export const buildPlanDayAssignments = (
  days: PlanDay[],
  mealIds: string[]
): PlanDayAssignment[] => {
  if (mealIds.length === 0) {
    throw new PlanGenerationError("No meals available to generate a plan.");
  }

  const unlockedDays = days.filter((day) => !day.locked);
  if (unlockedDays.length === 0) {
    return [];
  }

  const lockedMealIds = new Set(
    days
      .filter((day) => day.locked && day.mealId)
      .map((day) => day.mealId as string)
  );

  let availableMealIds = mealIds.filter((mealId) => !lockedMealIds.has(mealId));
  if (availableMealIds.length === 0) {
    availableMealIds = mealIds;
  }

  return unlockedDays.map((day, index) => ({
    id: day.id,
    mealId: availableMealIds[index % availableMealIds.length]
  }));
};

const mapPlanRow = (row: PlanRow): Omit<Plan, "days"> => ({
  id: row.id,
  weekStart: row.week_start,
  createdAt: row.created_at,
  createdBy: row.created_by,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by
});

const mapPlanDayRow = (row: PlanDayRow): PlanDay => ({
  id: row.id,
  planId: row.plan_id,
  date: row.date,
  mealId: row.meal_id,
  locked: row.locked,
  createdAt: row.created_at,
  createdBy: row.created_by,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by
});

const fetchPlanRow = async (
  supabase: SupabaseClient,
  householdId: string,
  weekStart: string
): Promise<PlanRow | null> => {
  const { data, error } = await supabase
    .from("plans")
    .select("id, week_start, created_at, created_by, updated_at, updated_by")
    .eq("household_id", householdId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as PlanRow | null;
};

const createPlanRow = async (
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  weekStart: string
): Promise<PlanRow> => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("plans")
    .insert({
      household_id: householdId,
      week_start: weekStart,
      created_at: now,
      created_by: userId
    })
    .select("id, week_start, created_at, created_by, updated_at, updated_by")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as PlanRow;
};

const ensurePlanDays = async (
  supabase: SupabaseClient,
  planId: string,
  householdId: string,
  userId: string,
  weekStart: string
) => {
  const weekDates = buildWeekDates(weekStart);
  const { data, error } = await supabase
    .from("plan_days")
    .select("date")
    .eq("plan_id", planId);

  if (error) {
    throw new Error(error.message);
  }

  const existingDates = new Set(
    ((data ?? []) as { date: string }[]).map((row) => row.date)
  );
  const missingDates = weekDates.filter((date) => !existingDates.has(date));

  if (missingDates.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const inserts = missingDates.map((date) => ({
    plan_id: planId,
    household_id: householdId,
    date,
    meal_id: null,
    locked: false,
    created_by: userId,
    created_at: now
  }));

  const { error: insertError } = await supabase
    .from("plan_days")
    .upsert(inserts, { onConflict: "plan_id,date", ignoreDuplicates: true });

  if (insertError) {
    throw new Error(insertError.message);
  }
};

const fetchPlanDays = async (
  supabase: SupabaseClient,
  planId: string,
  weekStart: string
): Promise<PlanDay[]> => {
  const weekDates = buildWeekDates(weekStart);
  const { data, error } = await supabase
    .from("plan_days")
    .select("id, plan_id, date, meal_id, locked, created_at, created_by, updated_at, updated_by")
    .eq("plan_id", planId)
    .in("date", weekDates)
    .order("date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const days = ((data ?? []) as PlanDayRow[]).map(mapPlanDayRow);
  if (days.length !== 7) {
    throw new Error("Expected 7 plan days.");
  }

  return days;
};

const fetchMealIds = async (
  supabase: SupabaseClient,
  householdId: string
): Promise<string[]> => {
  const { data, error } = await supabase
    .from("meals")
    .select("id, name")
    .eq("household_id", householdId)
    .order("name", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as MealRow[]).map((row) => row.id);
};

export async function fetchPlanForWeek(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  weekStart: string
): Promise<Plan> {
  const normalizedWeekStart = normalizeWeekStart(weekStart);
  let planRow = await fetchPlanRow(supabase, householdId, normalizedWeekStart);

  if (!planRow) {
    try {
      planRow = await createPlanRow(supabase, householdId, userId, normalizedWeekStart);
    } catch (error) {
      planRow = await fetchPlanRow(supabase, householdId, normalizedWeekStart);
      if (!planRow) {
        throw error;
      }
    }
  }

  await ensurePlanDays(supabase, planRow.id, householdId, userId, normalizedWeekStart);
  const days = await fetchPlanDays(supabase, planRow.id, normalizedWeekStart);

  return {
    ...mapPlanRow(planRow),
    days
  };
}

export async function generatePlanForWeek(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  weekStart: string
): Promise<Plan> {
  const plan = await fetchPlanForWeek(supabase, householdId, userId, weekStart);
  const mealIds = await fetchMealIds(supabase, householdId);
  const hadMeals = plan.days.some((day) => Boolean(day.mealId));

  const assignments = buildPlanDayAssignments(plan.days, mealIds);
  if (assignments.length === 0) {
    return plan;
  }

  const now = new Date().toISOString();

  for (const assignment of assignments) {
    const { error } = await supabase
      .from("plan_days")
      .update({
        meal_id: assignment.mealId,
        updated_at: now,
        updated_by: userId
      })
      .eq("id", assignment.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  const { error: planError } = await supabase
    .from("plans")
    .update({
      updated_at: now,
      updated_by: userId
    })
    .eq("id", plan.id);

  if (planError) {
    throw new Error(planError.message);
  }

  const action = hadMeals ? "plan.regenerated" : "plan.generated";
  void supabase.from("audit_log").insert({
    household_id: householdId,
    entity_type: "plan",
    entity_id: plan.id,
    action,
    actor_user_id: userId,
    summary: {
      planId: plan.id,
      weekStart: plan.weekStart
    },
    created_at: now
  });

  return fetchPlanForWeek(supabase, householdId, userId, plan.weekStart);
}
