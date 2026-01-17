import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError } from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import { ensureHouseholdContext } from "@/lib/household/server";
import { regeneratePlan } from "@/lib/plans/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ planId: string }> };

export async function POST(request: Request, routeContext: RouteContext) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const { planId } = await routeContext.params;

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const plan = await regeneratePlan(
      supabase,
      context.household.id,
      authResult.userId,
      planId
    );

    if (!plan) {
      return jsonError("Plan not found.", 404);
    }

    const response = NextResponse.json(plan);
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    console.error("[plans] POST /:planId/regenerate error:", error instanceof Error ? error.message : error);
    return jsonError("Unable to regenerate plan.", 500);
  }
}
