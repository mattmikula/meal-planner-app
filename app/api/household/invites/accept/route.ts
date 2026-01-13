import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError, validateRequest } from "@/lib/api/helpers";
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const validation = validateRequest(body, acceptHouseholdInviteSchema);
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
    console.error("[accept-invite] Error:", error instanceof Error ? error.message : error);
    return jsonError("Unable to accept invite.", 500);
  }
}
