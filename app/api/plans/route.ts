import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError, validateRequest } from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import { ensureHouseholdContext } from "@/lib/household/server";
import { fetchPlanForWeek, planFetchQuerySchema } from "@/lib/plans/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const url = new URL(request.url);
  const weekStart = url.searchParams.get("weekStart");
  const validation = validateRequest({ weekStart }, planFetchQuerySchema);
  if (!validation.success) {
    return validation.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const plan = await fetchPlanForWeek(
      supabase,
      context.household.id,
      authResult.userId,
      validation.data.weekStart
    );
    const response = NextResponse.json(plan);
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    console.error("[plans] GET error:", error instanceof Error ? error.message : error);
    return jsonError("Unable to load plan.", 500);
  }
}
