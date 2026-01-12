import { NextResponse } from "next/server";

import { requireApiUser, setAuthCookies } from "@/lib/auth/server";
import { fetchHouseholdMembership, hashInviteToken } from "@/lib/household/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AcceptPayload = {
  token?: string;
};

type InviteRow = {
  id: string;
  household_id: string;
  email: string;
  expires_at: string;
  accepted_at: string | null;
};

type InviteError = {
  message: string;
  status: number;
};

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const normalizeToken = (payload: AcceptPayload) => payload.token?.trim() ?? null;

const normalizeEmail = (email: string | null) => email?.trim().toLowerCase() ?? null;

const isInviteExpired = (expiresAt: string) =>
  new Date(expiresAt).getTime() <= Date.now();

const getInviteError = (invite: InviteRow, email: string): InviteError | null => {
  if (invite.accepted_at) {
    return { message: "Invite already used.", status: 409 };
  }
  if (isInviteExpired(invite.expires_at)) {
    return { message: "Invite expired.", status: 400 };
  }
  if (invite.email.toLowerCase() !== email) {
    return { message: "Invite email does not match.", status: 403 };
  }
  return null;
};

async function parsePayload(request: Request): Promise<AcceptPayload | null> {
  try {
    return (await request.json()) as AcceptPayload;
  } catch {
    return null;
  }
}

async function loadInvite(supabase: ReturnType<typeof createServerSupabaseClient>, tokenHash: string) {
  const { data, error } = await supabase
    .from("household_invites")
    .select("id, household_id, email, expires_at, accepted_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as InviteRow | null;
}

async function hasExistingMembership(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  userId: string
) {
  const membership = await fetchHouseholdMembership(supabase, userId);
  return Boolean(membership);
}

async function acceptInvite(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  inviteId: string,
  userId: string
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("household_invites")
    .update({
      accepted_at: now,
      accepted_by: userId
    })
    .eq("id", inviteId)
    .is("accepted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

async function createMember(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  householdId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("household_members")
    .insert({
      household_id: householdId,
      user_id: userId,
      role: "member",
      status: "active"
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create membership.");
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
    const invite = await loadInvite(supabase, tokenHash);

    if (!invite) {
      return jsonError("Invalid or expired invite.", 400);
    }

    const inviteError = getInviteError(invite, email);
    if (inviteError) {
      return jsonError(inviteError.message, inviteError.status);
    }

    const existingMembership = await hasExistingMembership(
      supabase,
      authResult.userId
    );
    if (existingMembership) {
      return jsonError("User already belongs to a household.", 409);
    }

    const accepted = await acceptInvite(
      supabase,
      invite.id,
      authResult.userId
    );
    if (!accepted) {
      return jsonError("Invite already used.", 409);
    }

    const memberId = await createMember(
      supabase,
      invite.household_id,
      authResult.userId
    );

    const response = NextResponse.json({
      householdId: invite.household_id,
      memberId
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
