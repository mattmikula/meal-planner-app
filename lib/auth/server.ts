import "server-only";
import type { Session } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  getCookieValue
} from "@/lib/auth/shared";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ApiAuthSuccess = {
  userId: string;
  email: string | null;
  session?: Session;
};

type ApiAuthFailure = {
  response: NextResponse;
};

const BEARER_TOKEN_REGEX = /^bearer\s+/i;

type RefreshResult = {
  userId: string;
  email: string | null;
  session: Session;
};

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

function toAuthSuccess(user: { id: string; email?: string | null }): ApiAuthSuccess {
  return {
    userId: user.id,
    email: user.email ?? null
  };
}

async function refreshWithToken(
  refreshToken: string
): Promise<RefreshResult | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session || !data.user) {
    return null;
  }

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    session: data.session
  };
}

async function getUserFromToken(token: string): Promise<ApiAuthSuccess | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return toAuthSuccess(data.user);
}

export async function requireApiUser(request: Request): Promise<ApiAuthSuccess | ApiAuthFailure> {
  const token = getAccessToken(request);
  const refreshToken = getRefreshToken(request);

  if (!token && !refreshToken) {
    return { response: unauthorizedResponse() };
  }

  if (!token && refreshToken) {
    const refreshed = await refreshWithToken(refreshToken);
    return refreshed ? refreshed : { response: unauthorizedResponse() };
  }

  if (!token) {
    return { response: unauthorizedResponse() };
  }

  const user = await getUserFromToken(token);
  if (user) {
    return user;
  }

  if (!refreshToken) {
    return { response: unauthorizedResponse() };
  }

  const refreshed = await refreshWithToken(refreshToken);
  return refreshed ? refreshed : { response: unauthorizedResponse() };
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
