import "server-only";
import { z } from "zod";

import type { components, paths } from "@/lib/api/types";
import { normalizeIngredient } from "@/lib/ingredients/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

export type Meal = {
  id: string;
  name: string;
  notes: string | null;
  imageUrl: string | null;
  ingredients: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

type MealRow = {
  id: string;
  name: string;
  notes: string | null;
  image_url: string | null;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
};

type IngredientRow = {
  id: string;
  name: string;
  normalized_name: string;
};

type MealIngredientRow = {
  meal_id: string;
  ingredients: { name: string } | { name: string }[] | null;
};

export type MealIdParams = paths["/api/meals/{id}"]["patch"]["parameters"]["path"];

export const mealIdParamSchema = z.object({
  id: z.string().uuid("Meal ID must be a valid UUID.")
}) satisfies z.ZodType<MealIdParams>;

const ingredientNameSchema = z
  .string()
  .trim()
  .min(1, "Ingredient name is required.")
  .max(100, "Ingredient name must be 100 characters or less.");

const sortIngredientNames = (names: string[]) =>
  [...names].sort((a, b) => a.localeCompare(b));

const buildIngredientInput = (ingredients: string[]) => {
  const seen = new Set<string>();
  const normalized: Array<{ name: string; normalized: string }> = [];

  for (const ingredient of ingredients) {
    const trimmed = ingredient.trim();
    if (!trimmed) {
      continue;
    }
    const normalizedName = normalizeIngredient(trimmed);
    if (!normalizedName || seen.has(normalizedName)) {
      continue;
    }
    seen.add(normalizedName);
    normalized.push({ name: trimmed, normalized: normalizedName });
  }

  return normalized;
};

const fetchMealIngredientNames = async (
  supabase: SupabaseClient,
  householdId: string,
  mealIds: string[]
) => {
  const ingredientsByMeal = new Map<string, string[]>();

  if (mealIds.length === 0) {
    return ingredientsByMeal;
  }

  const { data, error } = await supabase
    .from("meal_ingredients")
    .select("meal_id, ingredients(name)")
    .eq("household_id", householdId)
    .in("meal_id", mealIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as MealIngredientRow[]) {
    const ingredientName = Array.isArray(row.ingredients)
      ? row.ingredients[0]?.name
      : row.ingredients?.name;
    if (!ingredientName) {
      continue;
    }
    const existing = ingredientsByMeal.get(row.meal_id);
    if (existing) {
      existing.push(ingredientName);
    } else {
      ingredientsByMeal.set(row.meal_id, [ingredientName]);
    }
  }

  for (const [mealId, names] of ingredientsByMeal.entries()) {
    ingredientsByMeal.set(mealId, sortIngredientNames(names));
  }

  return ingredientsByMeal;
};

const replaceMealIngredients = async (
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  mealId: string,
  ingredients: string[]
) => {
  const normalizedIngredients = buildIngredientInput(ingredients);
  const now = new Date().toISOString();

  if (normalizedIngredients.length === 0) {
    const { error } = await supabase
      .from("meal_ingredients")
      .delete()
      .eq("meal_id", mealId)
      .eq("household_id", householdId);

    if (error) {
      throw new Error(error.message);
    }

    return [];
  }

  const normalizedNames = normalizedIngredients.map((entry) => entry.normalized);

  const { data: existingRows, error: existingError } = await supabase
    .from("ingredients")
    .select("id, name, normalized_name")
    .eq("household_id", householdId)
    .in("normalized_name", normalizedNames);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const ingredientByNormalized = new Map<string, IngredientRow>();
  for (const row of (existingRows ?? []) as IngredientRow[]) {
    ingredientByNormalized.set(row.normalized_name, row);
  }

  const missingRows = normalizedIngredients
    .filter((entry) => !ingredientByNormalized.has(entry.normalized))
    .map((entry) => ({
      household_id: householdId,
      name: entry.name,
      normalized_name: entry.normalized,
      created_at: now,
      created_by: userId
    }));

  if (missingRows.length > 0) {
    const { data: insertedRows, error: insertError } = await supabase
      .from("ingredients")
      .insert(missingRows)
      .select("id, name, normalized_name");

    if (insertError) {
      throw new Error(insertError.message);
    }

    for (const row of (insertedRows ?? []) as IngredientRow[]) {
      ingredientByNormalized.set(row.normalized_name, row);
    }
  }

  const ingredientRows = normalizedIngredients
    .map((entry) => ingredientByNormalized.get(entry.normalized))
    .filter((entry): entry is IngredientRow => Boolean(entry));

  const { error: deleteError } = await supabase
    .from("meal_ingredients")
    .delete()
    .eq("meal_id", mealId)
    .eq("household_id", householdId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const joinRows = ingredientRows.map((row) => ({
    household_id: householdId,
    meal_id: mealId,
    ingredient_id: row.id,
    created_at: now,
    created_by: userId
  }));

  if (joinRows.length > 0) {
    const { error: joinError } = await supabase
      .from("meal_ingredients")
      .insert(joinRows);

    if (joinError) {
      throw new Error(joinError.message);
    }
  }

  return sortIngredientNames(ingredientRows.map((row) => row.name));
};

const mapMeal = (row: MealRow, ingredients: string[]): Meal => ({
  id: row.id,
  name: row.name,
  notes: row.notes,
  imageUrl: row.image_url,
  ingredients,
  createdAt: row.created_at,
  createdBy: row.created_by,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by
});

export const createMealSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200, "Name must be 200 characters or less."),
  notes: z.string().max(1000, "Notes must be 1000 characters or less.").optional(),
  imageUrl: z.string().trim().url("Image URL must be a valid URL.").optional(),
  ingredients: z.array(ingredientNameSchema).optional()
}) satisfies z.ZodType<components["schemas"]["CreateMealRequest"]>;

export const updateMealSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200, "Name must be 200 characters or less.").optional(),
  notes: z.string().max(1000, "Notes must be 1000 characters or less.").optional(),
  imageUrl: z.string().trim().url("Image URL must be a valid URL.").nullable().optional(),
  ingredients: z.array(ingredientNameSchema).optional()
}).refine(data => data.name !== undefined || data.notes !== undefined || data.imageUrl !== undefined || data.ingredients !== undefined, {
  message: "At least one field (name, notes, imageUrl, or ingredients) must be provided."
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
    .select("id, name, notes, image_url, created_at, created_by, updated_at, updated_by")
    .eq("household_id", householdId)
    .order("name", { ascending: true });
  
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as MealRow[]) ?? [];
  const ingredientsByMeal = await fetchMealIngredientNames(
    supabase,
    householdId,
    rows.map((row) => row.id)
  );
  
  return rows.map((row) => mapMeal(row, ingredientsByMeal.get(row.id) ?? []));
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
      image_url: input.imageUrl || null,
      created_by: userId,
      created_at: now
    })
    .select("id, name, notes, image_url, created_at, created_by, updated_at, updated_by")
    .single();
  
  if (error) {
    throw new Error(error.message);
  }

  const ingredients = input.ingredients
    ? await replaceMealIngredients(supabase, householdId, userId, data.id, input.ingredients)
    : [];
  
  const meal = mapMeal(data as MealRow, ingredients);
  
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
    .select("id, name, notes, image_url, created_at, created_by, updated_at, updated_by")
    .eq("id", mealId)
    .eq("household_id", householdId)
    .maybeSingle();
  
  if (error) {
    throw new Error(error.message);
  }
  
  if (!data) {
    return null;
  }

  const ingredientsByMeal = await fetchMealIngredientNames(
    supabase,
    householdId,
    [data.id]
  );
  
  return mapMeal(data as MealRow, ingredientsByMeal.get(data.id) ?? []);
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

  if (input.imageUrl !== undefined) {
    updates.image_url = input.imageUrl || null;
  }
  
  const { data, error } = await supabase
    .from("meals")
    .update(updates)
    .eq("id", mealId)
    .eq("household_id", householdId)
    .select("id, name, notes, image_url, created_at, created_by, updated_at, updated_by")
    .maybeSingle();
  
  if (error) {
    throw new Error(error.message);
  }
  
  if (!data) {
    return null;
  }

  const ingredients =
    input.ingredients !== undefined
      ? await replaceMealIngredients(supabase, householdId, userId, mealId, input.ingredients)
      : (await fetchMealIngredientNames(supabase, householdId, [mealId])).get(mealId) ?? [];
  
  const meal = mapMeal(data as MealRow, ingredients);
  
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
