import { NextResponse } from "next/server";
import { z } from "zod";
import { applyAuthCookies, jsonError, logApiError } from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { switchCurrentHousehold, HouseholdAuthorizationError } from "@/lib/household/server";

const switchHouseholdSchema = z.object({
  householdId: z.string().uuid()
});

export async function POST(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = createServerSupabaseClient();

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const parseResult = switchHouseholdSchema.safeParse(body);
  if (!parseResult.success) {
    return jsonError("Invalid household ID", 400);
  }

  try {
    await switchCurrentHousehold(
      supabase,
      authResult.userId,
      parseResult.data.householdId
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
