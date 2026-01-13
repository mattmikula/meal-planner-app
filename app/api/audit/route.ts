import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError } from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import { ensureHouseholdContext } from "@/lib/household/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ENTITY_TYPES = new Set(["meal", "plan", "plan_day"]);

type AuditRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_user_id: string | null;
  created_at: string;
  summary: Record<string, unknown>;
};

const parseLimit = (limitParam: string | null) =>
  Math.min(Math.max(Number.parseInt(limitParam ?? "50", 10) || 50, 1), 100);

const parseEntity = (entity: string | null) => {
  if (!entity) {
    return null;
  }
  return ENTITY_TYPES.has(entity) ? entity : null;
};

const mapAuditRows = (rows: AuditRow[] | null) =>
  (rows ?? []).map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
    summary: row.summary
  }));

export async function GET(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const url = new URL(request.url);
  const rawEntity = url.searchParams.get("entity");
  const limit = parseLimit(url.searchParams.get("limit"));
  const entity = parseEntity(rawEntity);

  if (rawEntity && !entity) {
    return jsonError("Invalid entity filter.", 400);
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);

    let query = supabase
      .from("audit_log")
      .select("id, entity_type, entity_id, action, actor_user_id, created_at, summary")
      .eq("household_id", context.household.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (entity) {
      query = query.eq("entity_type", entity);
    }

    const { data, error } = await query;

    if (error) {
      return jsonError(error.message, 500);
    }

    const items = mapAuditRows(data as AuditRow[] | null);

    const response = NextResponse.json({ items });
    applyAuthCookies(response, authResult.session, request);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load audit events.";
    return jsonError(message, 500);
  }
}
