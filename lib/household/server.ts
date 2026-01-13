import "server-only";
import { createHash, randomBytes } from "node:crypto";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const INVITE_TTL_HOURS = 48;

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

export type HouseholdContext = {
  household: {
    id: string;
    name: string | null;
    createdAt: string;
  };
  membership: {
    id: string;
    householdId: string;
    userId: string;
    role: string;
    status: string;
    createdAt: string;
  };
};

type HouseholdMemberRow = {
  id: string;
  household_id: string;
  role: string;
  status: string;
  created_at: string;
};

type HouseholdRow = {
  id: string;
  name: string | null;
  created_at: string;
};

type HouseholdSettingsRow = {
  current_household_id: string | null;
};

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createInviteToken() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashInviteToken(token)
  };
}

/**
 * Calculates the expiry time for an invite based on INVITE_TTL_HOURS.
 * Accepts an optional `now` parameter for testability.
 * @param now - The current time (defaults to now). Used for testing.
 */
export function buildInviteExpiry(now: Date = new Date()) {
  const expiresAt = new Date(now.getTime() + INVITE_TTL_HOURS * 60 * 60 * 1000);
  return expiresAt.toISOString();
}

// Validate INVITE_ACCEPT_URL_BASE at module load time to prevent runtime failures
const VALIDATED_INVITE_BASE_URL = (() => {
  const baseUrl = process.env.INVITE_ACCEPT_URL_BASE?.trim();
  if (!baseUrl) {
    return null;
  }
  try {
    // Validate that it's a proper URL; if not, we'll fail fast at startup
    new URL(baseUrl);
    return baseUrl;
  } catch (e) {
    console.error(`[STARTUP ERROR] Invalid INVITE_ACCEPT_URL_BASE: "${baseUrl}". Invite URL generation will fail.`, e);
    return null;
  }
})();

/**
 * Builds an invite URL with the token as a query parameter.
 *
 * WARNING: Invite tokens in URLs can be logged by proxies, browsers, and analytics tools.
 * They MUST be sent only over secure channels (e.g., HTTPS links, encrypted email, or
 * trusted end-to-end encrypted messaging) and never via plaintext or untrusted channels.
 * Users and UIs should clearly warn people not to share screenshots or screen recordings
 * that include the invite URL, since this exposes the raw token.
 * The 48-hour expiry (INVITE_TTL_HOURS) limits the window of exposure if a link is leaked,
 * but it is only a mitigation and does not replace the need for secure transport and handling.
 *
 * @param token - The raw invite token to include in the URL
 * @returns The complete invite URL, or null if INVITE_ACCEPT_URL_BASE is not configured or invalid
 */
export function buildInviteUrl(token: string) {
  if (!VALIDATED_INVITE_BASE_URL) {
    return null;
  }

  const url = new URL(VALIDATED_INVITE_BASE_URL);
  url.searchParams.set("invite_token", token);
  return url.toString();
}

const mapMembership = (member: HouseholdMemberRow, userId: string) => ({
  id: member.id,
  householdId: member.household_id,
  userId,
  role: member.role,
  status: member.status,
  createdAt: member.created_at
});

async function fetchCurrentHouseholdId(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_household_settings")
    .select("current_household_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const settings = data as HouseholdSettingsRow | null;
  return settings?.current_household_id ?? null;
}

async function setCurrentHouseholdId(
  supabase: SupabaseClient,
  userId: string,
  householdId: string
) {
  const { error } = await supabase.from("user_household_settings").upsert(
    {
      user_id: userId,
      current_household_id: householdId,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchHouseholdMembership(
  supabase: SupabaseClient,
  userId: string,
  householdId?: string
) {
  const baseQuery = supabase
    .from("household_members")
    .select("id, household_id, role, status, created_at")
    .eq("user_id", userId)
    .eq("status", "active");

  if (householdId) {
    const { data, error } = await baseQuery
      .eq("household_id", householdId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return mapMembership(data as HouseholdMemberRow, userId);
  }

  const { data, error } = await baseQuery.order("created_at", { ascending: true }).limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const member = (data as HouseholdMemberRow[] | null)?.[0];
  return member ? mapMembership(member, userId) : null;
}

export async function fetchHouseholdContext(
  supabase: SupabaseClient,
  userId: string
): Promise<HouseholdContext | null> {
  const currentHouseholdId = await fetchCurrentHouseholdId(supabase, userId);
  let membership = currentHouseholdId
    ? await fetchHouseholdMembership(supabase, userId, currentHouseholdId)
    : null;

  if (!membership) {
    membership = await fetchHouseholdMembership(supabase, userId);
    if (!membership) {
      return null;
    }
    await setCurrentHouseholdId(supabase, userId, membership.householdId);
  }

  const { data, error } = await supabase
    .from("households")
    .select("id, name, created_at")
    .eq("id", membership.householdId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Missing household");
  }

  const household = data as HouseholdRow;

  return {
    household: {
      id: household.id,
      name: household.name,
      createdAt: household.created_at
    },
    membership
  };
}

export async function ensureHouseholdContext(
  supabase: SupabaseClient,
  userId: string
): Promise<HouseholdContext> {
  const existing = await fetchHouseholdContext(supabase, userId);
  if (existing) {
    return existing;
  }

  // Use RPC to create household and member atomically in a transaction
  const { data: result, error: rpcError } = await supabase.rpc(
    "create_household_with_member",
    { p_user_id: userId }
  );

  if (rpcError || !result) {
    throw new Error(rpcError?.message ?? "Unable to create household");
  }

  await setCurrentHouseholdId(supabase, userId, result.household_id);

  // Fetch the complete context after creation
  const context = await fetchHouseholdContext(supabase, userId);
  if (!context) {
    throw new Error("Failed to fetch created household context");
  }

  return context;
}
