import { NextResponse } from "next/server";

import { setAuthCookies } from "@/lib/auth/server";
import { normalizeEmail as normalizeEmailUtil } from "@/lib/utils/email";

/**
 * Creates a JSON error response with the specified message and status code.
 */
export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Checks if the request is using HTTPS, taking into account proxies/load balancers.
 *
 * If the X-Forwarded-Proto header is provided, it is used as the primary signal.
 * Otherwise, the URL protocol is used as a fallback.
 * 
 * SECURITY NOTE: In production, ensure your reverse proxy (nginx, ALB, etc.) strips
 * untrusted X-Forwarded-Proto headers from client requests. Otherwise, clients could
 * force insecure cookie settings by sending a forged header.
 */
export function isSecureRequest(
  requestUrl: string,
  forwardedProto?: string | null
): boolean {
  if (forwardedProto) {
    // X-Forwarded-Proto may contain a comma-separated list; use the first value.
    const proto = forwardedProto.split(",")[0]?.trim().toLowerCase();
    if (proto === "https") {
      return true;
    }
    if (proto === "http") {
      return false;
    }
  }

  return new URL(requestUrl).protocol === "https:";
}

/**
 * Applies authentication cookies to the response if a session is provided.
 * Automatically determines if secure cookies should be used based on the request protocol.
 *
 * Optionally, the X-Forwarded-Proto header can be provided to correctly handle
 * proxied HTTPS connections.
 */
export function applyAuthCookies(
  response: NextResponse,
  session: Parameters<typeof setAuthCookies>[1] | undefined,
  request: Request
) {
  if (!session) {
    return;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  setAuthCookies(response, session, {
    secure: isSecureRequest(request.url, forwardedProto)
  });
}

/**
 * Normalizes an email address by trimming whitespace and converting to lowercase.
 * Returns null if the input is null, undefined, or an empty string after trimming.
 */
export const normalizeEmail = normalizeEmailUtil;
