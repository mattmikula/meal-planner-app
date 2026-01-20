import { NextResponse } from "next/server";
import { z } from "zod";

import { applyAuthCookies, jsonError, logApiError } from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import { ensureHouseholdContext, updateHouseholdName } from "@/lib/household/server";
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

const updateHouseholdSchema = z.object({
  name: z.string().min(1).max(100)
});

export async function PATCH(request: Request) {
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

  const parseResult = updateHouseholdSchema.safeParse(body);
  if (!parseResult.success) {
    return jsonError("Invalid household name", 400);
  }

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    await updateHouseholdName(
      supabase,
      authResult.userId,
      context.household.id,
      parseResult.data.name
    );

    const response = NextResponse.json({ success: true });
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    logApiError("household PATCH", error, { userId: authResult.userId });
    return jsonError(
      error instanceof Error ? error.message : "Unable to update household.",
      400
    );
  }
}
