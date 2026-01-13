import { NextResponse } from "next/server";

import { setAuthCookies } from "@/lib/auth/server";

/**
 * Creates a JSON error response with the specified message and status code.
 */
export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Checks if the request URL uses HTTPS protocol.
 */
export function isSecureRequest(requestUrl: string) {
  return new URL(requestUrl).protocol === "https:";
}

/**
 * Applies authentication cookies to the response if a session is provided.
 * Automatically determines if secure cookies should be used based on the request protocol.
 */
export function applyAuthCookies(
  response: NextResponse,
  session: Parameters<typeof setAuthCookies>[1] | undefined,
  requestUrl: string
) {
  if (!session) {
    return;
  }

  setAuthCookies(response, session, {
    secure: isSecureRequest(requestUrl)
  });
}

/**
 * Normalizes an email address by trimming whitespace and converting to lowercase.
 * Returns null if the input is null, undefined, or an empty string after trimming.
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = (email ?? "").trim();
  return trimmed ? trimmed.toLowerCase() : null;
}
