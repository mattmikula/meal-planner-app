import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError, normalizeEmail } from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import {
  buildInviteExpiry,
  buildInviteUrl,
  createInviteToken,
  ensureHouseholdContext,
  InviteUrlConfigError
} from "@/lib/household/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type InvitePayload = {
  email?: string;
};

async function parsePayload(request: Request): Promise<InvitePayload | null> {
  try {
    return (await request.json()) as InvitePayload;
  } catch {
    return null;
  }
}

async function insertInvite(
  supabase: ReturnType<typeof createServerSupabaseClient>,
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

export async function POST(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const payload = await parsePayload(request);
  if (!payload) {
    return jsonError("Invalid request body.", 400);
  }

  // Validate that email is present and a string (runtime check for untrusted input)
  if (payload.email === undefined) {
    return jsonError("Email is required.", 400);
  }

  if (typeof payload.email !== "string") {
    return jsonError("Email must be a string.", 400);
  }

  const email = normalizeEmail(payload.email);
  if (!email) {
    return jsonError("Email is required.", 400);
  }

  // Basic email format validation (must have local part, @, and valid domain)
  const [localPart, domain] = email.split("@");
  if (
    !localPart ||
    !domain ||
    !domain.includes(".") ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.includes("..")
  ) {
    return jsonError("Invalid email format.", 400);
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const { token, tokenHash } = createInviteToken();
    // buildInviteUrl throws InviteUrlConfigError if INVITE_ACCEPT_URL_BASE is not configured
    const inviteUrl = buildInviteUrl(token);
    const expiresAt = buildInviteExpiry();

    const inviteId = await insertInvite(
      supabase,
      context.household.id,
      email,
      tokenHash,
      expiresAt,
      authResult.userId
    );

    const response = NextResponse.json({ inviteId, inviteUrl });
    applyAuthCookies(response, authResult.session, request);

    return response;
  } catch (error) {
    // Return a clearer error message for configuration issues
    if (error instanceof InviteUrlConfigError) {
      return jsonError("Invite URL configuration is missing or invalid.", 500);
    }
    const message = error instanceof Error ? error.message : "Unable to create invite.";
    return jsonError(message, 500);
  }
}
