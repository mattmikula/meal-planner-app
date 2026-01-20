import "server-only";
import type { Session } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { components } from "@/lib/api/types";
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

export const verifyOtpSchema = z
  .any()
  .superRefine((value, ctx) => {
    if (!value || typeof value !== "object") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email and code are required."
      });
      return;
    }

    const email = typeof value.email === "string" ? value.email.trim() : "";
    const token = typeof value.token === "string" ? value.token.trim() : "";

    if (!email || !token) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email and code are required."
      });
    }
  })
  .transform((value) => ({
    email: typeof value?.email === "string" ? value.email.trim() : "",
    token: typeof value?.token === "string" ? value.token.trim() : ""
  })) satisfies z.ZodType<components["schemas"]["VerifyOtpRequest"]>;

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

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

export async function requireUser(): Promise<ApiAuthSuccess | null> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null;

  if (!accessToken && !refreshToken) {
    return null;
  }

  if (!accessToken && refreshToken) {
    return await refreshWithToken(refreshToken);
  }

  if (!accessToken) {
    return null;
  }

  const user = await getUserFromToken(accessToken);
  if (user) {
    return user;
  }

  if (!refreshToken) {
    return null;
  }

  return await refreshWithToken(refreshToken);
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
