import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError, normalizeEmail } from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";
import {
  acceptInviteAtomic,
  fetchInviteByTokenHash,
  hashInviteToken,
  type InviteAcceptErrorCode
} from "@/lib/household/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AcceptPayload = {
  token?: string;
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

/**
 * Maps atomic error codes to user-friendly messages and HTTP status codes.
 */
function mapErrorCode(errorCode: InviteAcceptErrorCode): { message: string; status: number } {
  switch (errorCode) {
    case "already_accepted":
      return { message: "Invite already used.", status: 409 };
    case "already_member":
      return { message: "You are already a member of this household.", status: 409 };
  }
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

  const userEmail = normalizeEmail(authResult.email);
  if (!userEmail) {
    return jsonError("User email is required.", 400);
  }

  const supabase = createServerSupabaseClient();

  try {
    const tokenHash = hashInviteToken(tokenResult.token);

    // Fetch invite and validate in application code (per AGENTS.md guidelines)
    const invite = await fetchInviteByTokenHash(supabase, tokenHash);

    if (!invite) {
      return jsonError("Invalid or expired invite.", 400);
    }

    if (invite.acceptedAt) {
      return jsonError("Invite already used.", 409);
    }

    if (new Date(invite.expiresAt) <= new Date()) {
      return jsonError("Invite expired.", 400);
    }

    // Email comparison - both should be lowercase after normalization
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      return jsonError(
        "This invite was sent to a different email address than the one you're signed in with.",
        403
      );
    }

    // Call minimal atomic function for database operations
    const result = await acceptInviteAtomic(
      supabase,
      invite.id,
      invite.householdId,
      authResult.userId
    );

    if ("errorCode" in result) {
      const { message, status } = mapErrorCode(result.errorCode);
      return jsonError(message, status);
    }

    const response = NextResponse.json({
      householdId: invite.householdId,
      memberId: result.memberId
    });
    applyAuthCookies(response, authResult.session, request);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to accept invite.";
    return jsonError(message, 500);
  }
}
