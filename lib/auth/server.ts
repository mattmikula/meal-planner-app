import type { Session } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  getCookieValue
} from "@/lib/auth/shared";

const BEARER_TOKEN_REGEX = /^bearer\s+/i;

export function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !BEARER_TOKEN_REGEX.test(authHeader)) {
    return null;
  }

  const token = authHeader.replace(BEARER_TOKEN_REGEX, "").trim();
  return token || null;
}

export function getAccessToken(request: Request) {
  return getBearerToken(request) ?? getCookieValue(request.headers.get("cookie"), ACCESS_TOKEN_COOKIE);
}

export function getRefreshToken(request: Request) {
  return getCookieValue(request.headers.get("cookie"), REFRESH_TOKEN_COOKIE);
}

export function setAuthCookies(
  response: NextResponse,
  session: Session,
  { secure }: { secure: boolean }
) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: typeof session.expires_in === "number" ? session.expires_in : undefined
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS
  });
}

export function clearAuthCookies(response: NextResponse, { secure }: { secure: boolean }) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
