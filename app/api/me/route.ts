import { NextResponse } from "next/server";

import { applyAuthCookies } from "@/lib/api/helpers";
import { requireApiUser } from "@/lib/auth/server";

export async function GET(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const response = NextResponse.json({
    id: authResult.userId,
    email: authResult.email
  });

  applyAuthCookies(response, authResult.session, request);

  return response;
}
