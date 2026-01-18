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
  deleteMeal,
  mealIdParamSchema,
  updateMeal,
  updateMealSchema
} from "@/lib/meals/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = {
  params: { id: string };
};

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const { id: mealId } = context.params;

  const paramValidation = validateRequest({ id: mealId }, mealIdParamSchema);
  if (!paramValidation.success) {
    return paramValidation.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.success) {
    return bodyResult.response;
  }

  const validation = validateRequest(bodyResult.data, updateMealSchema);
  if (!validation.success) {
    return validation.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const household = await ensureHouseholdContext(supabase, authResult.userId);
    const meal = await updateMeal(
      supabase,
      household.household.id,
      authResult.userId,
      mealId,
      validation.data
    );

    if (!meal) {
      return jsonError("Meal not found.", 404);
    }

    const response = NextResponse.json(meal);
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    logApiError("meals PATCH", error, { mealId, userId: authResult.userId });
    return jsonError("Unable to update meal.", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const { id: mealId } = context.params;
  const paramValidation = validateRequest({ id: mealId }, mealIdParamSchema);
  if (!paramValidation.success) {
    return paramValidation.response;
  }
  const supabase = createServerSupabaseClient();

  try {
    const household = await ensureHouseholdContext(supabase, authResult.userId);
    const deleted = await deleteMeal(
      supabase,
      household.household.id,
      authResult.userId,
      mealId
    );

    if (!deleted) {
      return jsonError("Meal not found.", 404);
    }

    const response = NextResponse.json({ ok: true });
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    logApiError("meals DELETE", error, { mealId, userId: authResult.userId });
    return jsonError("Unable to delete meal.", 500);
  }
}
