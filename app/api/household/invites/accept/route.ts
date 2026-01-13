import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError, normalizeEmail } from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import { hashInviteToken } from "@/lib/household/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AcceptPayload = {
  token?: string;
};

type InviteError = {
  message: string;
  status: number;
};

type InviteAcceptResult = {
  household_id: string | null;
  member_id: string | null;
  error_message: string | null;
  error_status: number | null;
};

type TokenValidationResult =
  | { valid: true; token: string }
  | { valid: false; error: "missing" | "whitespace" };

const normalizeToken = (payload: AcceptPayload): TokenValidationResult => {
  if (typeof payload.token !== "string") {
    return { valid: false, error: "missing" };
  }
  const trimmed = payload.token.trim();
  if (!trimmed && payload.token.length > 0) {
    return { valid: false, error: "whitespace" };
  }
  if (!trimmed) {
    return { valid: false, error: "missing" };
  }
  return { valid: true, token: trimmed };
};

async function parsePayload(request: Request): Promise<AcceptPayload | null> {
  try {
    return (await request.json()) as AcceptPayload;
  } catch {
    return null;
  }
}

async function acceptInvite(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  tokenHash: string
): Promise<{ householdId: string; memberId: string } | InviteError> {
  const { data, error } = await supabase
    .rpc("accept_household_invite", {
      p_token_hash: tokenHash
    })
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Unable to accept invite.");
  }

  const result = data as InviteAcceptResult;
  if (result.error_message) {
    return {
      message: result.error_message,
      status: result.error_status ?? 500
    };
  }

  if (!result.household_id || !result.member_id) {
    throw new Error("Unable to accept invite.");
  }

  return {
    householdId: result.household_id,
    memberId: result.member_id
  };
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

  const tokenResult = normalizeToken(payload);
  if (!tokenResult.valid) {
    if (tokenResult.error === "whitespace") {
      return jsonError("Token cannot be empty or whitespace.", 400);
    }
    return jsonError("Token is required.", 400);
  }

  // Note: Email normalization also happens in the database stored procedure
  // (accept_household_invite). Both use lowercase normalization. If either
  // implementation changes, ensure they remain consistent to avoid mismatches.
  const email = normalizeEmail(authResult.email);
  if (!email) {
    return jsonError("User email is required.", 400);
  }

  const supabase = createServerSupabaseClient();

  try {
    const tokenHash = hashInviteToken(tokenResult.token);
    const result = await acceptInvite(
      supabase,
      tokenHash
    );

    if ("status" in result) {
      return jsonError(result.message, result.status);
    }

    const response = NextResponse.json({
      householdId: result.householdId,
      memberId: result.memberId
    });
    applyAuthCookies(response, authResult.session, request);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to accept invite.";
    return jsonError(message, 500);
  }
}
