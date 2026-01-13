import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

import { setAuthCookies } from "@/lib/auth/server";
import { normalizeEmail as normalizeEmailUtil } from "@/lib/utils/email";

/**
 * Creates a JSON error response with the specified message and status code.
 */
export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Validates data against a Zod schema.
 * Returns parsed data on success, or a 400 error response on failure.
 */
export function validateRequest<T>(
  data: unknown,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.issues[0];
      const message = firstError?.message || "Invalid request body.";
      return { success: false, response: jsonError(message, 400) };
    }
    return { success: false, response: jsonError("Invalid request body.", 400) };
  }
}

/**
 * Checks if the request is using HTTPS, taking into account proxies/load balancers.
 *
 * If the X-Forwarded-Proto header is provided, it is used as the primary signal.
 * Otherwise, the URL protocol is used as a fallback.
 * 
 * Security Note: This function trusts the provided `forwardedProto` value. Only pass
 * a value derived from the X-Forwarded-Proto header if your app is behind a trusted
 * reverse proxy (nginx, ALB, etc.) that strips or overwrites any client-provided
 * X-Forwarded-Proto header. If you cannot guarantee this, call this function without
 * a forwardedProto value so that only the URL protocol is used.
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
    // Header is present but has an unexpected value; treat as insecure rather than
    // falling back to the URL protocol to avoid ambiguous/misleading behavior.
    console.warn(
      `Unexpected X-Forwarded-Proto value "${forwardedProto}" (normalized: "${proto}"); treating request as insecure. ` +
      "Check your reverse proxy or load balancer configuration."
    );
    return false;
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
