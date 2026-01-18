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
  createHouseholdInvite,
  createHouseholdInviteSchema,
  InviteUrlConfigError
} from "@/lib/household/server";
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

  const validation = validateRequest(bodyResult.data, createHouseholdInviteSchema);
  if (!validation.success) {
    return validation.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const invite = await createHouseholdInvite(
      supabase,
      context.household.id,
      authResult.userId,
      validation.data
    );

    const response = NextResponse.json(invite);
    applyAuthCookies(response, authResult.session, request);

    return response;
  } catch (error) {
    // Return a clearer error message for configuration issues
    if (error instanceof InviteUrlConfigError) {
      return jsonError("Invite URL configuration is missing or invalid.", 500);
    }
    // Log internal error details but return generic message to avoid leaking internals
    logApiError("household invites POST", error, { userId: authResult.userId });
    return jsonError("Unable to create invite.", 500);
  }
}
