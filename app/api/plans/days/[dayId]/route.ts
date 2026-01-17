import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError, validateRequest } from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import { ensureHouseholdContext } from "@/lib/household/server";
import { updatePlanDay, updatePlanDayRequestSchema } from "@/lib/plans/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ dayId: string }> };

export async function PATCH(request: Request, routeContext: RouteContext) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const { dayId } = await routeContext.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const validation = validateRequest(body, updatePlanDayRequestSchema);
  if (!validation.success) {
    return validation.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const planDay = await updatePlanDay(
      supabase,
      context.household.id,
      authResult.userId,
      dayId,
      validation.data
    );

    if (!planDay) {
      return jsonError("Plan day not found.", 404);
    }

    const response = NextResponse.json(planDay);
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    console.error("[plans] PATCH /days/:dayId error:", error instanceof Error ? error.message : error);
    return jsonError("Unable to update plan day.", 500);
  }
}
