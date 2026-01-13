import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError, validateRequest } from "@/lib/api/helpers";
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const validation = validateRequest(body, createHouseholdInviteSchema);
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
    console.error("[create-invite] Error:", error instanceof Error ? error.message : error);
    return jsonError("Unable to create invite.", 500);
  }
}
