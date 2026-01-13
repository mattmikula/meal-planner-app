import "server-only";

import type { components } from "@/lib/api/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

export const AUDIT_ENTITY_TYPES = ["meal", "plan", "plan_day"] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];
export type AuditEvent = components["schemas"]["AuditEvent"];
type AuditEventSummary = components["schemas"]["AuditEvent"]["summary"];

type AuditRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_user_id: string | null;
  created_at: string;
  summary: Record<string, unknown>;
};

/**
 * Parses and clamps the limit parameter to a safe range [1, 100].
 * Returns 50 as the default if the parameter is missing or invalid (NaN).
 */
export const parseAuditLimit = (limitParam: string | null): number => {
  const DEFAULT_LIMIT = 50;
  const MIN_LIMIT = 1;
  const MAX_LIMIT = 100;

  const parsed = Number.parseInt(limitParam ?? "", 10);
  const value = Number.isNaN(parsed) ? DEFAULT_LIMIT : parsed;

  return Math.min(Math.max(value, MIN_LIMIT), MAX_LIMIT);
};

export const parseAuditEntity = (entity: string | null): AuditEntityType | null => {
  if (!entity) {
    return null;
  }
  return AUDIT_ENTITY_TYPES.includes(entity as AuditEntityType)
    ? (entity as AuditEntityType)
    : null;
};

const mapAuditRows = (rows: AuditRow[] | null): AuditEvent[] =>
  (rows ?? []).map((row) => ({
    id: row.id,
    entityType: row.entity_type as AuditEntityType,
    entityId: row.entity_id,
    action: row.action,
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
    summary: row.summary as AuditEventSummary
  }));

export async function listAuditEvents(
  supabase: SupabaseClient,
  householdId: string,
  options: { entity: AuditEntityType | null; limit: number }
): Promise<{ items: AuditEvent[] } | { error: string }> {
  let query = supabase
    .from("audit_log")
    .select("id, entity_type, entity_id, action, actor_user_id, created_at, summary")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(options.limit);

  if (options.entity) {
    query = query.eq("entity_type", options.entity);
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  return { items: mapAuditRows(data as AuditRow[] | null) };
}
