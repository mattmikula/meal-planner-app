import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError } from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import { ensureHouseholdContext } from "@/lib/household/server";
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
    applyAuthCookies(response, authResult.session, request.url);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load household.";
    return jsonError(message, 500);
  }
}
