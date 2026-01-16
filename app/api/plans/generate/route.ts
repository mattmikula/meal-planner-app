import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError, validateRequest } from "@/lib/api/helpers";
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const validation = validateRequest(body, planGenerateRequestSchema);
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
    console.error("[plans] POST /generate error:", error instanceof Error ? error.message : error);
    return jsonError("Unable to generate plan.", 500);
  }
}
