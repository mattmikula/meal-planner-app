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
  ensureHouseholdContext,
  HouseholdAuthorizationError,
  HouseholdValidationError,
  updateHouseholdSchema,
  updateHouseholdName
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
    const context = await ensureHouseholdContext(supabase, authResult.userId);
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

  const supabase = createServerSupabaseClient();

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.success) {
    return bodyResult.response;
  }

  const validation = validateRequest(bodyResult.data, updateHouseholdSchema);
  if (!validation.success) {
    return validation.response;
  }

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    await updateHouseholdName(
      supabase,
      authResult.userId,
      context.household.id,
      validation.data.name
    );

    const response = NextResponse.json({ success: true });
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    if (error instanceof HouseholdAuthorizationError || error instanceof HouseholdValidationError) {
      return jsonError(error.message, 400);
    }

    logApiError("household PATCH", error, { userId: authResult.userId });
    return jsonError("Unable to update household.", 500);
  }
}
