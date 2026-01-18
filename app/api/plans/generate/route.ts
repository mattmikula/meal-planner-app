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
  generatePlanForWeek,
  planGenerateRequestSchema,
  PlanGenerationError
} from "@/lib/plans/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.success) {
    return bodyResult.response;
  }

  const validation = validateRequest(bodyResult.data, planGenerateRequestSchema);
  if (!validation.success) {
    return validation.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const plan = await generatePlanForWeek(
      supabase,
      context.household.id,
      authResult.userId,
      validation.data.weekStart
    );
    const response = NextResponse.json(plan);
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    if (error instanceof PlanGenerationError) {
      return jsonError(error.message, error.status);
    }
    logApiError("plans POST /generate", error, { userId: authResult.userId });
    return jsonError("Unable to generate plan.", 500);
  }
}
