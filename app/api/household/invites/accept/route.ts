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
  acceptHouseholdInvite,
  acceptHouseholdInviteSchema
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

  const validation = validateRequest(bodyResult.data, acceptHouseholdInviteSchema);
  if (!validation.success) {
    return validation.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const result = await acceptHouseholdInvite(
      supabase,
      authResult.userId,
      authResult.email ?? null,
      validation.data
    );

    if ("status" in result) {
      return jsonError(result.message, result.status);
    }

    const response = NextResponse.json({
      householdId: result.householdId,
      memberId: result.memberId
    });
    applyAuthCookies(response, authResult.session, request);

    return response;
  } catch (error) {
    // Log internal error details but return generic message to avoid leaking internals
    logApiError("household invites accept POST", error, { userId: authResult.userId });
    return jsonError("Unable to accept invite.", 500);
  }
}
