import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError, validateRequest } from "@/lib/api/helpers";
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
    console.error("[meals] GET error:", error instanceof Error ? error.message : error);
    return jsonError("Unable to load meals.", 500);
  }
}

export async function POST(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const validation = validateRequest(body, createMealSchema);
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
    console.error("[meals] POST error:", error instanceof Error ? error.message : error);
    return jsonError("Unable to create meal.", 500);
  }
}
