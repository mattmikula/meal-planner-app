import "server-only";
import { z } from "zod";

import type { components } from "@/lib/api/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

export type IngredientRow = {
  id: string;
  name: string;
  normalized_name: string;
};

type MealIngredientRow = {
  meal_id: string;
  ingredient_id: string;
  meals: { name: string } | { name: string }[] | null;
};

const INGREDIENT_NAME_REQUIRED_MESSAGE = "Ingredient name is required.";
const INGREDIENT_NAME_LENGTH_MESSAGE =
  "Ingredient name must be 100 characters or less.";
const INGREDIENTS_REQUIRED_MESSAGE = "Enter at least one ingredient.";
const NO_MATCHES_MESSAGE = "No matching meals found.";

export type IngredientSuggestionRequest = components["schemas"]["IngredientSuggestionRequest"];
export type IngredientSuggestion = components["schemas"]["IngredientSuggestion"];

export const ingredientNameSchema = z
  .string()
  .trim()
  .min(1, INGREDIENT_NAME_REQUIRED_MESSAGE)
  .max(100, INGREDIENT_NAME_LENGTH_MESSAGE);

export const ingredientSuggestionSchema = z.object({
  ingredients: z.array(ingredientNameSchema).min(1, INGREDIENTS_REQUIRED_MESSAGE)
}) satisfies z.ZodType<IngredientSuggestionRequest>;

export class IngredientSuggestionError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function normalizeIngredient(value: string): string {
  return value.trim().toLowerCase();
}

export function selectSuggestedMeal(
  meals: Array<{ id: string; name: string; ingredients: string[] }>,
  normalizedInputs: string[]
): IngredientSuggestion | null {
  if (meals.length === 0 || normalizedInputs.length === 0) {
    return null;
  }

  const inputSet = new Set(normalizedInputs);
  const candidates = meals
    .map((meal) => {
      const matched = meal.ingredients.filter((ingredient) =>
        inputSet.has(normalizeIngredient(ingredient))
      );

      if (matched.length === 0) {
        return null;
      }

      matched.sort((a, b) => a.localeCompare(b));

      return {
        mealId: meal.id,
        name: meal.name,
        matchedIngredients: matched
      };
    })
    .filter((entry): entry is IngredientSuggestion => Boolean(entry));

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((best, current) => {
    const matchDelta = current.matchedIngredients.length - best.matchedIngredients.length;
    if (matchDelta !== 0) {
      return matchDelta > 0 ? current : best;
    }

    const nameDelta = current.name.localeCompare(best.name, "en", { sensitivity: "base" });
    if (nameDelta !== 0) {
      return nameDelta < 0 ? current : best;
    }

    return current.mealId < best.mealId ? current : best;
  });
}

export async function suggestMealFromIngredients(
  supabase: SupabaseClient,
  householdId: string,
  input: IngredientSuggestionRequest
): Promise<IngredientSuggestion> {
  const normalizedInputs = Array.from(
    new Set(input.ingredients.map((ingredient) => normalizeIngredient(ingredient)))
  ).filter(Boolean);

  if (normalizedInputs.length === 0) {
    throw new IngredientSuggestionError(INGREDIENTS_REQUIRED_MESSAGE, 400);
  }

  const { data: ingredientRows, error: ingredientError } = await supabase
    .from("ingredients")
    .select("id, name, normalized_name")
    .eq("household_id", householdId)
    .in("normalized_name", normalizedInputs);

  if (ingredientError) {
    throw new Error(ingredientError.message);
  }

  if (!ingredientRows || ingredientRows.length === 0) {
    throw new IngredientSuggestionError(NO_MATCHES_MESSAGE, 404);
  }

  const ingredientMap = new Map<string, IngredientRow>();
  for (const row of ingredientRows as IngredientRow[]) {
    ingredientMap.set(row.id, row);
  }

  const ingredientIds = Array.from(ingredientMap.keys());

  const { data: matchRows, error: matchError } = await supabase
    .from("meal_ingredients")
    .select("meal_id, ingredient_id, meals(name)")
    .eq("household_id", householdId)
    .in("ingredient_id", ingredientIds);

  if (matchError) {
    throw new Error(matchError.message);
  }

  const meals = new Map<string, { id: string; name: string; ingredients: string[] }>();

  for (const row of (matchRows ?? []) as MealIngredientRow[]) {
    const mealName = Array.isArray(row.meals)
      ? row.meals[0]?.name
      : row.meals?.name;
    if (!mealName) {
      continue;
    }
    const ingredient = ingredientMap.get(row.ingredient_id);
    if (!ingredient) {
      continue;
    }

    const existing = meals.get(row.meal_id);
    if (existing) {
      existing.ingredients.push(ingredient.name);
    } else {
      meals.set(row.meal_id, {
        id: row.meal_id,
        name: mealName,
        ingredients: [ingredient.name]
      });
    }
  }

  const suggestion = selectSuggestedMeal(
    Array.from(meals.values()),
    normalizedInputs
  );

  if (!suggestion) {
    throw new IngredientSuggestionError(NO_MATCHES_MESSAGE, 404);
  }

  return suggestion;
}
