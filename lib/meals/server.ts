import "server-only";
import { z } from "zod";

import type { components } from "@/lib/api/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

export type Meal = {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

type MealRow = {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
};

const mapMeal = (row: MealRow): Meal => ({
  id: row.id,
  name: row.name,
  notes: row.notes,
  createdAt: row.created_at,
  createdBy: row.created_by,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by
});

export const createMealSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200, "Name must be 200 characters or less."),
  notes: z.string().max(1000, "Notes must be 1000 characters or less.").optional()
}) satisfies z.ZodType<components["schemas"]["CreateMealRequest"]>;

export const updateMealSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200, "Name must be 200 characters or less.").optional(),
  notes: z.string().max(1000, "Notes must be 1000 characters or less.").optional()
}).refine(data => data.name !== undefined || data.notes !== undefined, {
  message: "At least one field (name or notes) must be provided."
}) satisfies z.ZodType<components["schemas"]["UpdateMealRequest"]>;

export type CreateMealInput = z.infer<typeof createMealSchema>;
export type UpdateMealInput = z.infer<typeof updateMealSchema>;

/**
 * Lists all meals for a household.
 */
export async function listMeals(
  supabase: SupabaseClient,
  householdId: string
): Promise<Meal[]> {
  const { data, error } = await supabase
    .from("meals")
    .select("id, name, notes, created_at, created_by, updated_at, updated_by")
    .eq("household_id", householdId)
    .order("name", { ascending: true });
  
  if (error) {
    throw new Error(error.message);
  }
  
  return (data as MealRow[]).map(mapMeal);
}

/**
 * Creates a new meal for a household.
 */
export async function createMeal(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  input: CreateMealInput
): Promise<Meal> {
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from("meals")
    .insert({
      household_id: householdId,
      name: input.name,
      notes: input.notes || null,
      created_by: userId,
      created_at: now
    })
    .select("id, name, notes, created_at, created_by, updated_at, updated_by")
    .single();
  
  if (error) {
    throw new Error(error.message);
  }
  
  const meal = mapMeal(data as MealRow);
  
  // Log audit event (fire-and-forget for activity tracking)
  // Errors are intentionally not checked as audit logging is best-effort
  void supabase.from("audit_log").insert({
    household_id: householdId,
    entity_type: "meal",
    entity_id: meal.id,
    action: "meal.created",
    actor_user_id: userId,
    summary: {
      mealId: meal.id,
      name: meal.name
    },
    created_at: now
  });
  
  return meal;
}

/**
 * Fetches a single meal by ID.
 * Returns null if not found or not in the specified household.
 */
export async function fetchMeal(
  supabase: SupabaseClient,
  householdId: string,
  mealId: string
): Promise<Meal | null> {
  const { data, error } = await supabase
    .from("meals")
    .select("id, name, notes, created_at, created_by, updated_at, updated_by")
    .eq("id", mealId)
    .eq("household_id", householdId)
    .maybeSingle();
  
  if (error) {
    throw new Error(error.message);
  }
  
  if (!data) {
    return null;
  }
  
  return mapMeal(data as MealRow);
}

/**
 * Updates an existing meal.
 */
export async function updateMeal(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  mealId: string,
  input: UpdateMealInput
): Promise<Meal | null> {
  const now = new Date().toISOString();
  
  const updates: Record<string, unknown> = {
    updated_by: userId,
    updated_at: now
  };
  
  if (input.name !== undefined) {
    updates.name = input.name;
  }
  
  if (input.notes !== undefined) {
    updates.notes = input.notes || null;
  }
  
  const { data, error } = await supabase
    .from("meals")
    .update(updates)
    .eq("id", mealId)
    .eq("household_id", householdId)
    .select("id, name, notes, created_at, created_by, updated_at, updated_by")
    .maybeSingle();
  
  if (error) {
    throw new Error(error.message);
  }
  
  if (!data) {
    return null;
  }
  
  const meal = mapMeal(data as MealRow);
  
  // Log audit event (fire-and-forget for activity tracking)
  // Errors are intentionally not checked as audit logging is best-effort
  void supabase.from("audit_log").insert({
    household_id: householdId,
    entity_type: "meal",
    entity_id: meal.id,
    action: "meal.updated",
    actor_user_id: userId,
    summary: {
      mealId: meal.id,
      name: meal.name
    },
    created_at: now
  });
  
  return meal;
}

/**
 * Deletes a meal.
 * Returns true if deleted, false if not found.
 */
export async function deleteMeal(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  mealId: string
): Promise<boolean> {
  // Fetch the meal first to get its name for the audit log
  const meal = await fetchMeal(supabase, householdId, mealId);
  
  if (!meal) {
    return false;
  }
  
  const { error } = await supabase
    .from("meals")
    .delete()
    .eq("id", mealId)
    .eq("household_id", householdId);
  
  if (error) {
    throw new Error(error.message);
  }
  
  // Log audit event (fire-and-forget for activity tracking)
  // Errors are intentionally not checked as audit logging is best-effort
  void supabase.from("audit_log").insert({
    household_id: householdId,
    entity_type: "meal",
    entity_id: mealId,
    action: "meal.deleted",
    actor_user_id: userId,
    summary: {
      mealId,
      name: meal.name
    },
    created_at: new Date().toISOString()
  });
  
  return true;
}
