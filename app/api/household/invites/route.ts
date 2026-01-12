import { NextResponse } from "next/server";

import { requireApiUser, setAuthCookies } from "@/lib/auth/server";
import {
  buildInviteExpiry,
  buildInviteUrl,
  createInviteToken,
  ensureHouseholdContext
} from "@/lib/household/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type InvitePayload = {
  email?: string;
};

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const normalizeEmail = (payload: InvitePayload) =>
  payload.email?.trim().toLowerCase() ?? null;

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

  const email = normalizeEmail(payload);
  if (!email) {
    return jsonError("Email is required.", 400);
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const { token, tokenHash } = createInviteToken();
    const inviteUrl = buildInviteUrl(token);
    if (!inviteUrl) {
      return jsonError("Missing invite URL configuration.", 500);
    }
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

    if (authResult.session) {
      setAuthCookies(response, authResult.session, {
        secure: new URL(request.url).protocol === "https:"
      });
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create invite.";
    return jsonError(message, 500);
  }
}
