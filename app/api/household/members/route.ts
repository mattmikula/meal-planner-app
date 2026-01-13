import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError } from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import { ensureHouseholdContext, listHouseholdMembers } from "@/lib/household/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const members = await listHouseholdMembers(supabase, context.household.id);
    const response = NextResponse.json({ members });
    applyAuthCookies(response, authResult.session, request);

    return response;
  } catch (error) {
    // Log internal error details but return generic message to avoid leaking internals
    console.error("[household-members] Error:", error instanceof Error ? error.message : error);
    return jsonError("Unable to load members.", 500);
  }
}
