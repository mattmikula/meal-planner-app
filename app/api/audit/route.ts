import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError, logApiError } from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import {
  listAuditEvents,
  parseAuditEntity,
  parseAuditLimit
} from "@/lib/audit/server";
import { ensureHouseholdContext } from "@/lib/household/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const url = new URL(request.url);
  const rawEntity = url.searchParams.get("entity");
  const limit = parseAuditLimit(url.searchParams.get("limit"));
  const entity = parseAuditEntity(rawEntity);

  if (rawEntity && !entity) {
    return jsonError("Invalid entity filter.", 400);
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const result = await listAuditEvents(supabase, context.household.id, {
      entity,
      limit
    });

    if ("error" in result) {
      return jsonError(result.error, 500);
    }

    const response = NextResponse.json({ items: result.items });
    applyAuthCookies(response, authResult.session, request);

    return response;
  } catch (error) {
    // Log internal error details but return generic message to avoid leaking internals
    logApiError("audit GET", error, { userId: authResult.userId });
    return jsonError("Unable to load audit events.", 500);
  }
}
