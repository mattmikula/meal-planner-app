import { NextResponse } from "next/server";

import {
  applyAuthCookies,
  jsonError,
  logApiError,
  parseJsonBody,
  validateRequest
} from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import { ensureHouseholdContext } from "@/lib/household/server";
import {
  createGroceryItem,
  createGroceryItemSchema,
  listGroceries
} from "@/lib/groceries/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const items = await listGroceries(supabase, context.household.id);
    const response = NextResponse.json({ items });
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    logApiError("groceries GET", error, { userId: authResult.userId });
    return jsonError("Unable to load grocery items.", 500);
  }
}

export async function POST(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.success) {
    return bodyResult.response;
  }

  const validation = validateRequest(bodyResult.data, createGroceryItemSchema);
  if (!validation.success) {
    return validation.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const item = await createGroceryItem(
      supabase,
      context.household.id,
      authResult.userId,
      validation.data
    );
    const response = NextResponse.json(item);
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    logApiError("groceries POST", error, { userId: authResult.userId });
    return jsonError("Unable to create grocery item.", 500);
  }
}
