import { NextResponse } from "next/server";

import { requireApiUser, setAuthCookies } from "@/lib/auth/server";
import { ensureHouseholdContext } from "@/lib/household/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const isSecureRequest = (requestUrl: string) =>
  new URL(requestUrl).protocol === "https:";

const buildHouseholdPayload = (context: {
  household: { id: string; name: string | null };
  membership: { role: string; status: string };
}) => ({
  id: context.household.id,
  name: context.household.name,
  role: context.membership.role,
  status: context.membership.status
});

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

export async function GET(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = createServerSupabaseClient();

  try {
    const context = await ensureHouseholdContext(supabase, authResult.userId);
    const response = NextResponse.json(buildHouseholdPayload(context));
    applyAuthCookies(response, authResult.session, request.url);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load household.";
    return jsonError(message, 500);
  }
}
