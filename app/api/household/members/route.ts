import { NextResponse } from "next/server";

import { requireApiUser, setAuthCookies } from "@/lib/auth/server";
import { ensureHouseholdContext } from "@/lib/household/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
};

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const isSecureRequest = (requestUrl: string) =>
  new URL(requestUrl).protocol === "https:";

const applyAuthCookies = (
  response: NextResponse,
  session: Parameters<typeof setAuthCookies>[1] | undefined,
  requestUrl: string
) => {
  if (!session) {
    return;
  }

  setAuthCookies(response, session, {
    secure: isSecureRequest(requestUrl)
  });
};

const mapMembers = (members: MemberRow[]) =>
  members.map((member) => ({
    id: member.id,
    userId: member.user_id,
    role: member.role,
    status: member.status,
    createdAt: member.created_at
  }));

async function fetchMembers(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  householdId: string
) {
  const { data, error } = await supabase
    .from("household_members")
    .select("id, user_id, role, status, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as MemberRow[] | null) ?? [];
}

export async function GET(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const members = await fetchMembers(supabase, context.household.id);
    const response = NextResponse.json({ members: mapMembers(members) });
    applyAuthCookies(response, authResult.session, request.url);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load members.";
    return jsonError(message, 500);
  }
}
