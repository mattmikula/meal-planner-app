import { NextResponse } from "next/server";

import {
  requireApiUser,
  setAuthCookies
} from "@/lib/auth/server";

export async function GET(request: Request) {
  const authResult = await requireApiUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const response = NextResponse.json({
    id: authResult.userId,
    email: authResult.email
  });

  if (authResult.session) {
    setAuthCookies(response, authResult.session, {
      secure: new URL(request.url).protocol === "https:"
    });
  }

  return response;
}
