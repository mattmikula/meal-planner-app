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
  PlanMutationError,
  planDayIdParamSchema,
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

  const paramValidation = validateRequest({ id: planDayId }, planDayIdParamSchema);
  if (!paramValidation.success) {
    return paramValidation.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.success) {
    return bodyResult.response;
  }

  const validation = validateRequest(bodyResult.data, updatePlanDaySchema);
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
    logApiError("plans PATCH /days", error, { planDayId, userId: authResult.userId });
    return jsonError("Unable to update plan day.", 500);
  }
}
