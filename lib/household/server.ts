import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import type { components } from "@/lib/api/types";
import { logger } from "@/lib/api/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/utils/email";

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

export type HouseholdMember = components["schemas"]["HouseholdMember"];
export type HouseholdSummary = components["schemas"]["HouseholdSummary"];
type HouseholdRole = components["schemas"]["HouseholdSummary"]["role"];
type HouseholdStatus = components["schemas"]["HouseholdSummary"]["status"];

type HouseholdMemberRow = {
  id: string;
  household_id: string;
  role: string;
  status: string;
  created_at: string;
};

type HouseholdMemberDetailRow = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
};

type HouseholdSummaryRow = {
  id: string;
  household_id: string;
  role: HouseholdRole;
  status: HouseholdStatus;
  created_at: string;
  households:
    | {
        id: string;
        name: string | null;
      }
    | {
        id: string;
        name: string | null;
      }[]
    | null;
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
    logger.error(
      { err: e, baseUrl },
      "Invalid INVITE_ACCEPT_URL_BASE; invite URL generation will fail."
    );
    return null;
  }
})();

export class InviteUrlConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InviteUrlConfigError";
  }
}

/**
 * Builds an invite URL with the token as a query parameter.
 *
 * WARNING: Invite tokens in URLs can be logged by proxies, browsers, and analytics tools.
 * They MUST be sent only over secure channels (e.g., HTTPS links, encrypted email, or
 * trusted end-to-end encrypted messaging) and never via plaintext or untrusted channels.
 * Users and UIs should clearly warn people not to share screenshots or screen recordings
 * that include the invite URL, since this exposes the raw token.
 *
 * The 48-hour expiry (INVITE_TTL_HOURS) limits the window of exposure if a link is leaked,
 * but it is only a mitigation and does not replace the need for secure transport and handling.
 * Invite-acceptance endpoints SHOULD implement additional controls such as:
 *   - rate limiting per IP/user and per invite token,
 *   - tracking and limiting failed invite-acceptance attempts per token, and
 *   - allowing users or the system to revoke specific invites before they expire.
 * These measures help detect and reduce abuse if an invite URL is leaked during its TTL.
 *
 * @param token - The raw invite token to include in the URL
 * @returns The complete invite URL
 * @throws {InviteUrlConfigError} If INVITE_ACCEPT_URL_BASE is not configured or invalid
 */
export function buildInviteUrl(token: string): string {
  if (!VALIDATED_INVITE_BASE_URL) {
    throw new InviteUrlConfigError(
      "INVITE_ACCEPT_URL_BASE environment variable is not configured or invalid. " +
      "Set it to a valid URL (e.g., https://example.com/invite) to enable invite links."
    );
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

const mapHouseholdSummary = (
  row: HouseholdSummaryRow,
  currentHouseholdId: string | null
): HouseholdSummary => {
  const household = Array.isArray(row.households)
    ? row.households[0] ?? null
    : row.households ?? null;

  return {
    id: row.household_id,
    name: household?.name ?? null,
    role: row.role,
    status: row.status,
    isCurrent: row.household_id === currentHouseholdId
  };
};

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

async function updateHouseholdName(
  supabase: SupabaseClient,
  householdId: string,
  name: string | null
) {
  const { error } = await supabase
    .from("households")
    .update({ name })
    .eq("id", householdId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function listHouseholdsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<HouseholdSummary[]> {
  const currentHouseholdId = await fetchCurrentHouseholdId(supabase, userId);

  const { data, error } = await supabase
    .from("household_members")
    .select("id, household_id, role, status, created_at, households (id, name)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as HouseholdSummaryRow[] | null) ?? [];
  const householdIds = new Set(rows.map((row) => row.household_id));
  const effectiveCurrentId =
    currentHouseholdId && householdIds.has(currentHouseholdId)
      ? currentHouseholdId
      : null;

  return rows.map((row) => mapHouseholdSummary(row, effectiveCurrentId));
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

export async function listHouseholdMembers(
  supabase: SupabaseClient,
  householdId: string
): Promise<HouseholdMember[]> {
  const { data, error } = await supabase
    .from("household_members")
    .select("id, user_id, role, status, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as HouseholdMemberDetailRow[] | null) ?? []).map((member) => ({
    id: member.id,
    userId: member.user_id,
    role: member.role,
    status: member.status,
    createdAt: member.created_at
  })) as HouseholdMember[];
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

export async function fetchHouseholdContextReadOnly(
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
  userId: string,
  householdName?: string | null
): Promise<HouseholdContext> {
  const existing = await fetchHouseholdContext(supabase, userId);
  if (existing) {
    return existing;
  }

  // Use RPC to create household and member atomically in a transaction
  const { data: result, error: rpcError } = await supabase.rpc(
    "create_household_with_member",
    {
      p_user_id: userId,
      p_name: householdName ?? null
    }
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

const householdIdSchema = z
  .any()
  .superRefine((value, ctx) => {
    if (value === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Household is required."
      });
      return;
    }
    if (typeof value !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Household ID must be a string."
      });
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Household is required."
      });
      return;
    }
    if (!z.string().uuid().safeParse(trimmed).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Household ID must be a valid UUID."
      });
    }
  })
  .transform((value) => (typeof value === "string" ? value.trim() : value)) as z.ZodType<string>;

const householdNameSchema = z
  .any()
  .superRefine((value, ctx) => {
    if (value === null) {
      return;
    }
    if (typeof value !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Name must be a string."
      });
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Name cannot be empty."
      });
      return;
    }
    if (trimmed.length > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Name must be 100 characters or less."
      });
    }
  })
  .transform((value) => (typeof value === "string" ? value.trim() : value)) as z.ZodType<
  string | null
>;

export const updateCurrentHouseholdSchema = z.object({
  householdId: householdIdSchema,
  name: householdNameSchema.optional()
}) satisfies z.ZodType<components["schemas"]["UpdateCurrentHouseholdRequest"]>;

export type UpdateCurrentHouseholdInput = z.infer<typeof updateCurrentHouseholdSchema>;

export async function setCurrentHouseholdForUser(
  supabase: SupabaseClient,
  userId: string,
  householdId: string,
  householdName?: string | null
): Promise<HouseholdContext | { status: number; message: string }> {
  const membership = await fetchHouseholdMembership(supabase, userId, householdId);
  if (!membership) {
    return { status: 403, message: "You are not a member of this household." };
  }

  if (householdName !== undefined) {
    if (membership.role !== "owner") {
      return { status: 403, message: "Only household owners can rename this household." };
    }
    await updateHouseholdName(supabase, householdId, householdName);
  }

  await setCurrentHouseholdId(supabase, userId, householdId);

  const context = await fetchHouseholdContext(supabase, userId);
  if (!context) {
    throw new Error("Missing household context after update.");
  }

  return context;
}

const INVITE_EMAIL_FORMAT_SCHEMA = z.string().email();

const inviteEmailSchema = z
  .any()
  .superRefine((value, ctx) => {
    if (value === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email is required."
      });
      return;
    }
    if (typeof value !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email must be a string."
      });
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email is required."
      });
      return;
    }
    if (!INVITE_EMAIL_FORMAT_SCHEMA.safeParse(trimmed).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid email format."
      });
    }
  })
  .transform((value) =>
    typeof value === "string" ? value.trim().toLowerCase() : value
  ) as z.ZodType<string>;

export const createHouseholdInviteSchema = z.object({
  email: inviteEmailSchema,
  householdId: householdIdSchema.optional()
}) satisfies z.ZodType<components["schemas"]["HouseholdInviteRequest"]>;

export type CreateHouseholdInviteInput = z.infer<typeof createHouseholdInviteSchema>;

const inviteTokenSchema = z
  .any()
  .superRefine((value, ctx) => {
    if (value === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Token is required."
      });
      return;
    }
    if (typeof value !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Token is required."
      });
      return;
    }
    if (!value.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Token is required."
      });
      return;
    }
    if (!value.trim().length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Token cannot be empty or whitespace."
      });
    }
  })
  .transform((value) => (typeof value === "string" ? value.trim() : value)) as z.ZodType<string>;

export const acceptHouseholdInviteSchema = z.object({
  token: inviteTokenSchema
}) satisfies z.ZodType<components["schemas"]["HouseholdInviteAcceptRequest"]>;

export type AcceptHouseholdInviteInput = z.infer<typeof acceptHouseholdInviteSchema>;

async function insertInvite(
  supabase: SupabaseClient,
  householdId: string,
  email: string,
  tokenHash: string,
  expiresAt: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("household_invites")
    .insert({
      household_id: householdId,
      email,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: userId
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create invite.");
  }

  return data.id as string;
}

export async function createHouseholdInvite(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  input: CreateHouseholdInviteInput
): Promise<{ inviteId: string; inviteUrl: string }> {
  const { token, tokenHash } = createInviteToken();
  const inviteUrl = buildInviteUrl(token);
  const expiresAt = buildInviteExpiry();

  const inviteId = await insertInvite(
    supabase,
    householdId,
    input.email,
    tokenHash,
    expiresAt,
    userId
  );

  return { inviteId, inviteUrl };
}

export async function acceptHouseholdInvite(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string | null,
  input: AcceptHouseholdInviteInput
): Promise<{ householdId: string; memberId: string } | { status: number; message: string }> {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail) {
    return { status: 400, message: "User email is required." };
  }

  const tokenHash = hashInviteToken(input.token);
  const invite = await fetchInviteByTokenHash(supabase, tokenHash);

  if (!invite) {
    return { status: 400, message: "Invalid or expired invite." };
  }

  if (invite.acceptedAt) {
    return { status: 409, message: "Invite already used." };
  }

  if (new Date(invite.expiresAt) <= new Date()) {
    return { status: 400, message: "Invite expired." };
  }

  if (invite.email !== normalizedEmail) {
    return { status: 403, message: "This invite is for a different email address." };
  }

  const result = await acceptInviteAtomic(
    supabase,
    invite.id,
    invite.householdId,
    userId
  );

  if ("errorCode" in result) {
    switch (result.errorCode) {
      case "invite_not_found":
        return { status: 400, message: "Invalid or expired invite." };
      case "already_accepted":
        return { status: 409, message: "Invite already used." };
      case "already_member":
        return { status: 409, message: "You are already a member of this household." };
    }
  }

  await setCurrentHouseholdId(supabase, userId, invite.householdId);

  return { householdId: invite.householdId, memberId: result.memberId };
}

// Types for invite operations
export type InviteRecord = {
  id: string;
  householdId: string;
  email: string;
  expiresAt: string;
  acceptedAt: string | null;
};

type InviteRow = {
  id: string;
  household_id: string;
  email: string;
  expires_at: string;
  accepted_at: string | null;
};

/**
 * Fetches an invite by its token hash.
 * Returns null if the invite doesn't exist.
 */
export async function fetchInviteByTokenHash(
  supabase: SupabaseClient,
  tokenHash: string
): Promise<InviteRecord | null> {
  const { data, error } = await supabase
    .from("household_invites")
    .select("id, household_id, email, expires_at, accepted_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as InviteRow;
  return {
    id: row.id,
    householdId: row.household_id,
    email: row.email,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at
  };
}

// Error codes returned by accept_invite_atomic
export type InviteAcceptErrorCode = "invite_not_found" | "already_accepted" | "already_member";

type AcceptInviteAtomicResult = {
  member_id: string | null;
  error_code: InviteAcceptErrorCode | null;
};

/**
 * Atomically accepts an invite: creates/reactivates membership, marks invite as accepted.
 * Business logic validation (email, expiry) should be done BEFORE calling this function.
 * 
 * @returns The new member ID on success, or an error code on failure
 */
export async function acceptInviteAtomic(
  supabase: SupabaseClient,
  inviteId: string,
  householdId: string,
  userId: string
): Promise<{ memberId: string } | { errorCode: InviteAcceptErrorCode }> {
  const { data, error } = await supabase
    .rpc("accept_invite_atomic", {
      p_invite_id: inviteId,
      p_household_id: householdId,
      p_user_id: userId
    })
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const result = data as AcceptInviteAtomicResult;
  
  if (result.error_code) {
    return { errorCode: result.error_code };
  }

  if (!result.member_id) {
    throw new Error("Unable to accept invite.");
  }

  return { memberId: result.member_id };
}
