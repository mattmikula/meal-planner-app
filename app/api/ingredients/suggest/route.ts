import { NextResponse } from "next/server";

import {
  applyAuthCookies,
  jsonError,
  logApiError,
  parseJsonBody,
  validateRequest
} from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import { ensureHouseholdContext } from "@/lib/household/server";
import {
  IngredientSuggestionError,
  ingredientSuggestionSchema,
  suggestMealFromIngredients
} from "@/lib/ingredients/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const SUGGESTION_FAILURE_MESSAGE = "Unable to suggest a meal.";

export async function POST(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.success) {
    return bodyResult.response;
  }

  const validation = validateRequest(bodyResult.data, ingredientSuggestionSchema);
  if (!validation.success) {
    return validation.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const suggestion = await suggestMealFromIngredients(
      supabase,
      context.household.id,
      validation.data
    );
    const response = NextResponse.json(suggestion);
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    if (error instanceof IngredientSuggestionError) {
      return jsonError(error.message, error.status);
    }
    logApiError("ingredients suggest POST", error, { userId: authResult.userId });
    return jsonError(SUGGESTION_FAILURE_MESSAGE, 500);
  }
}
