import { NextResponse } from "next/server";
import {
  applyAuthCookies,
  jsonError,
  logApiError,
  parseJsonBody,
  validateRequest
} from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  switchCurrentHousehold,
  HouseholdAuthorizationError,
  switchHouseholdSchema
} from "@/lib/household/server";

export async function POST(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = createServerSupabaseClient();

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.success) {
    return bodyResult.response;
  }

  const validation = validateRequest(bodyResult.data, switchHouseholdSchema);
  if (!validation.success) {
    return validation.response;
  }

  try {
    await switchCurrentHousehold(
      supabase,
      authResult.userId,
      validation.data.householdId
    );
    const response = NextResponse.json({ success: true });
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    logApiError("household switch POST", error, { userId: authResult.userId });
    if (error instanceof HouseholdAuthorizationError) {
      return jsonError(error.message, 400);
    }
    return jsonError("Failed to switch household", 500);
  }
}
