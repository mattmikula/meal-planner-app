import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError, validateRequest } from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import { ensureHouseholdContext } from "@/lib/household/server";
import {
  PlanMutationError,
  updatePlanDay,
  updatePlanDaySchema
} from "@/lib/plans/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = {
  params: { id: string };
};

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const { id: planDayId } = context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const validation = validateRequest(body, updatePlanDaySchema);
  if (!validation.success) {
    return validation.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const householdContext = await ensureHouseholdContext(supabase, authResult.userId);
    const planDay = await updatePlanDay(
      supabase,
      householdContext.household.id,
      authResult.userId,
      planDayId,
      validation.data
    );

    if (!planDay) {
      return jsonError("Plan day not found.", 404);
    }

    const response = NextResponse.json(planDay);
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    if (error instanceof PlanMutationError) {
      return jsonError(error.message, error.status);
    }
    console.error(
      "[plans] PATCH /days error:",
      error instanceof Error ? error.message : error
    );
    return jsonError("Unable to update plan day.", 500);
  }
}
