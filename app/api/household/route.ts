import { NextResponse } from "next/server";

import {
  applyAuthCookies,
  jsonError,
  logApiError,
  parseJsonBody,
  validateRequest
} from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import {
  fetchHouseholdContextReadOnly,
  setCurrentHouseholdForUser,
  updateCurrentHouseholdSchema
} from "@/lib/household/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const buildHouseholdPayload = (context: {
  household: { id: string; name: string | null };
  membership: { role: string; status: string };
}) => ({
  id: context.household.id,
  name: context.household.name,
  role: context.membership.role,
  status: context.membership.status
});

export async function GET(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await fetchHouseholdContextReadOnly(supabase, authResult.userId);
    if (!context) {
      return jsonError("Household not found.", 404);
    }
    const response = NextResponse.json(buildHouseholdPayload(context));
    applyAuthCookies(response, authResult.session, request);

    return response;
  } catch (error) {
    // Log internal error details but return generic message to avoid leaking internals
    logApiError("household GET", error, { userId: authResult.userId });
    return jsonError("Unable to load household.", 500);
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.success) {
    return bodyResult.response;
  }

  const validation = validateRequest(bodyResult.data, updateCurrentHouseholdSchema);
  if (!validation.success) {
    return validation.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const result = await setCurrentHouseholdForUser(
      supabase,
      authResult.userId,
      validation.data.householdId,
      validation.data.name
    );

    if ("status" in result) {
      return jsonError(result.message, result.status);
    }

    const response = NextResponse.json(buildHouseholdPayload(result));
    applyAuthCookies(response, authResult.session, request);

    return response;
  } catch (error) {
    // Log internal error details but return generic message to avoid leaking internals
    logApiError("household PATCH", error, { userId: authResult.userId });
    return jsonError("Unable to update household.", 500);
  }
}
