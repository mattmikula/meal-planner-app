import { NextResponse } from "next/server";

import { requireApiUser, setAuthCookies } from "@/lib/auth/server";
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

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const normalizeToken = (payload: AcceptPayload) => payload.token?.trim() ?? null;

const normalizeEmail = (email: string | null) => email?.trim().toLowerCase() ?? null;

async function parsePayload(request: Request): Promise<AcceptPayload | null> {
  try {
    return (await request.json()) as AcceptPayload;
  } catch {
    return null;
  }
}

async function acceptInvite(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  tokenHash: string,
  userId: string,
  email: string
): Promise<{ householdId: string; memberId: string } | InviteError> {
  const { data, error } = await supabase
    .rpc("accept_household_invite", {
      p_token_hash: tokenHash,
      p_user_id: userId,
      p_email: email
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

  const token = normalizeToken(payload);
  if (!token) {
    return jsonError("Token is required.", 400);
  }

  const email = normalizeEmail(authResult.email);
  if (!email) {
    return jsonError("User email is required.", 400);
  }

  const supabase = createServerSupabaseClient();

  try {
    const tokenHash = hashInviteToken(token);
    const result = await acceptInvite(
      supabase,
      tokenHash,
      authResult.userId,
      email
    );

    if ("status" in result) {
      return jsonError(result.message, result.status);
    }

    const response = NextResponse.json({
      householdId: result.householdId,
      memberId: result.memberId
    });

    if (authResult.session) {
      setAuthCookies(response, authResult.session, {
        secure: new URL(request.url).protocol === "https:"
      });
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to accept invite.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
