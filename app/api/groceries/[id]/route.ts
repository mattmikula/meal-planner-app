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
  deleteGroceryItem,
  groceryIdParamSchema,
  updateGroceryItem,
  updateGroceryItemSchema
} from "@/lib/groceries/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = {
  params: { id: string };
};

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const { id: itemId } = context.params;
  const paramValidation = validateRequest({ id: itemId }, groceryIdParamSchema);
  if (!paramValidation.success) {
    return paramValidation.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.success) {
    return bodyResult.response;
  }

  const validation = validateRequest(bodyResult.data, updateGroceryItemSchema);
  if (!validation.success) {
    return validation.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const contextResult = await ensureHouseholdContext(supabase, authResult.userId);
    const item = await updateGroceryItem(
      supabase,
      contextResult.household.id,
      authResult.userId,
      itemId,
      validation.data
    );

    if (!item) {
      return jsonError("Grocery item not found.", 404);
    }

    const response = NextResponse.json(item);
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    logApiError("groceries PATCH", error, { itemId, userId: authResult.userId });
    return jsonError("Unable to update grocery item.", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const { id: itemId } = context.params;
  const paramValidation = validateRequest({ id: itemId }, groceryIdParamSchema);
  if (!paramValidation.success) {
    return paramValidation.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const contextResult = await ensureHouseholdContext(supabase, authResult.userId);
    const deleted = await deleteGroceryItem(
      supabase,
      contextResult.household.id,
      itemId
    );

    if (!deleted) {
      return jsonError("Grocery item not found.", 404);
    }

    const response = NextResponse.json({ ok: true });
    applyAuthCookies(response, authResult.session, request);
    return response;
  } catch (error) {
    logApiError("groceries DELETE", error, { itemId, userId: authResult.userId });
    return jsonError("Unable to delete grocery item.", 500);
  }
}
