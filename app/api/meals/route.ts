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
  createMeal,
  createMealSchema,
  listMeals
} from "@/lib/meals/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const meals = await listMeals(supabase, context.household.id);
    const response = NextResponse.json({ meals });
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    logApiError("meals GET", error, { userId: authResult.userId });
    return jsonError("Unable to load meals.", 500);
  }
}

export async function POST(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.success) {
    return bodyResult.response;
  }

  const validation = validateRequest(bodyResult.data, createMealSchema);
  if (!validation.success) {
    return validation.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const meal = await createMeal(
      supabase,
      context.household.id,
      authResult.userId,
      validation.data
    );
    const response = NextResponse.json(meal);
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    logApiError("meals POST", error, { userId: authResult.userId });
    return jsonError("Unable to create meal.", 500);
  }
}
