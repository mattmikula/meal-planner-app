import { NextResponse } from "next/server";
import { applyAuthCookies, jsonError, logApiError } from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listUserHouseholds } from "@/lib/household/server";

export async function GET(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const households = await listUserHouseholds(supabase, authResult.userId);
    const response = NextResponse.json({ households });
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    logApiError("household list GET", error, { userId: authResult.userId });
    return jsonError("Unable to load households.", 500);
  }
}
